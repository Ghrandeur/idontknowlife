#!/usr/bin/env python3
"""NIMELSSA local application server. Python 3.10+, standard library only."""
import argparse, base64, getpass, hashlib, hmac, json, mimetypes, os, secrets, sqlite3, time, uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, unquote
from http.cookies import SimpleCookie

ROOT = Path(__file__).resolve().parent
DB = ROOT / '.data' / 'site.sqlite3'
COLLECTIONS = ['leaders','parliamentarians','departments','gallery','archive','documents','past-questions','marketplace','advisors','faq','topics','replies','socials','department-socials','newsletter']
OBJECTS = ['faculty','settings']
SESSIONS = {}
ATTEMPTS = {}

def db():
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row; return c

def init():
    DB.parent.mkdir(exist_ok=True)
    with db() as c:
        c.executescript('''CREATE TABLE IF NOT EXISTS content(kind TEXT PRIMARY KEY, body TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS admins(email TEXT PRIMARY KEY,salt TEXT NOT NULL,password TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY,kind TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL,created REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS subscribers(email TEXT PRIMARY KEY,body TEXT NOT NULL,created REAL NOT NULL);''')
        seed = json.loads((ROOT/'data/seed.json').read_text())
        for k,v in seed.items(): c.execute('INSERT OR IGNORE INTO content VALUES (?,?)',(k,json.dumps(v)))

def payload():
    with db() as c: return {r['kind']:json.loads(r['body']) for r in c.execute('SELECT * FROM content')}

def password_hash(password, salt):
    return hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),310000).hex()

def clean_public(kind, value):
    if kind == 'topics':
        return [{k:v for k,v in item.items() if k not in ['email','privateName']} for item in value]
    if kind == 'replies':
        return [{k:v for k,v in item.items() if k not in ['email','privateName']} for item in value]
    return value

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw): super().__init__(*a,directory=str(ROOT),**kw)
    def copyfile(self, source, outputfile):
        try:super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionResetError):pass
    def log_message(self, format, *args):
        # Do not log request bodies, cookies or credentials.
        super().log_message(format,*args)
    def end_headers(self):
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Referrer-Policy','strict-origin-when-cross-origin')
        super().end_headers()
    def send_json(self,value,status=200,cookie=None):
        raw=json.dumps(value,ensure_ascii=False).encode();self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(raw)))
        if cookie:self.send_header('Set-Cookie',cookie)
        self.end_headers();self.wfile.write(raw)
    def body(self):
        size=int(self.headers.get('Content-Length','0'))
        if size>15000000:raise ValueError('Request too large. Maximum file size is 8 MB.')
        obj=json.loads(self.rfile.read(size) or b'{}')
        if not isinstance(obj,dict):raise ValueError('Expected a JSON object.')
        return obj
    def session(self):
        auth=self.headers.get('Authorization','')
        token=auth[7:].strip() if auth.startswith('Bearer ') else ''
        cookie=SimpleCookie();cookie.load(self.headers.get('Cookie',''));key=cookie.get('nimelssa_session')
        for value in [token,key.value if key else '']:
            sess=SESSIONS.get(value)
            if sess and sess['expires']>time.time():return sess
        return None
    def authorized(self):
        if not self.session():self.send_json({'error':'Please sign in to continue.'},401);return False
        return True
    def same_origin(self):
        origin=self.headers.get('Origin')
        return not origin or urlparse(origin).netloc==self.headers.get('Host')
    def do_GET(self):
        path=urlparse(self.path).path
        if path=='/api/content':
            return self.send_json({k:clean_public(k,v) for k,v in payload().items()})
        if path=='/api/session':
            s=self.session()
            with db() as c:configured=c.execute('SELECT COUNT(*) FROM admins').fetchone()[0]>0
            return self.send_json({'authenticated':bool(s),'email':s['email'] if s else None,'configured':configured})
        if path=='/api/admin/content':
            if not self.authorized():return
            with db() as c:
                pending=[dict(r) for r in c.execute('SELECT * FROM submissions ORDER BY created DESC')]
                for r in pending:r['body']=json.loads(r['body'])
                subs=[json.loads(r['body']) for r in c.execute('SELECT body FROM subscribers ORDER BY created DESC')]
            with db() as c: team=[dict(r) for r in c.execute('SELECT email FROM admins ORDER BY email')]
            return self.send_json({'content':payload(),'submissions':pending,'subscribers':subs,'team':team})
        if path.startswith('/api/'):return self.send_json({'error':'Not found'},404)
        # Keep source files, database and package internals off the public server.
        p=unquote(path)
        if any(part.startswith('.') for part in Path(p).parts) or p.startswith(('/node_modules','/server.py','/package','/README','/tests')) or (p.startswith('/data/') and p!='/data/seed.json'):
            return self.send_error(404)
        clean_path=unquote(urlparse(path).path)
        if clean_path.endswith('/'):clean_path=clean_path+'index.html'
        elif not Path(clean_path).suffix:
            clean_path=clean_path+'.html'
            if not (ROOT/clean_path.lstrip('/')).exists():clean_path=urlparse(path).path
        self.path=clean_path
        requested=(ROOT/unquote(urlparse(self.path).path).lstrip('/')).resolve()
        if not requested.is_relative_to(ROOT):return self.send_error(404)
        if not requested.exists():
            raw=(ROOT/'404.html').read_bytes();self.send_response(404);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw);return
        return super().do_GET()
    def save_upload(self,obj):
        upload=obj.pop('upload',None)
        if not upload:return None
        mime=upload.get('type','');allowed={'image/jpeg':('.jpg',b'\xff\xd8\xff'),'image/png':('.png',b'\x89PNG\r\n\x1a\n'),'image/webp':('.webp',b'RIFF'),'application/pdf':('.pdf',b'%PDF-')}
        if mime not in allowed:raise ValueError('Use a JPG, PNG, WebP image or PDF document.')
        raw=base64.b64decode(upload.get('data',''),validate=True);ext,magic=allowed[mime]
        if len(raw)>8*1024*1024 or not raw.startswith(magic):raise ValueError('Invalid file or file larger than 8 MB.')
        if mime=='image/webp' and raw[8:12]!=b'WEBP':raise ValueError('Invalid WebP image.')
        dest=ROOT/'assets/user-uploads';dest.mkdir(exist_ok=True);name=uuid.uuid4().hex+ext;(dest/name).write_bytes(raw)
        return '/assets/user-uploads/'+name
    def limited(self,kind,limit=10,window=3600):
        key=(self.client_address[0],kind);recent=[v for v in ATTEMPTS.get(key,[]) if time.time()-v<window]
        ATTEMPTS[key]=recent+[time.time()]
        if len(recent)>=limit:self.send_json({'error':'Too many requests. Please try again later.'},429);return True
        return False
    def do_POST(self):
        if not self.same_origin():return self.send_json({'error':'Request origin not allowed.'},403)
        path=urlparse(self.path).path
        try:
            obj=self.body()
            if path=='/api/login':
                if self.limited('login',8,900):return
                email=str(obj.get('email','')).strip().lower();password=str(obj.get('password',''))
                with db() as c:row=c.execute('SELECT * FROM admins WHERE email=?',(email,)).fetchone()
                valid=row and hmac.compare_digest(password_hash(password,row['salt']),row['password'])
                if not valid:return self.send_json({'error':'Email or password is incorrect.'},401)
                key=secrets.token_urlsafe(32);SESSIONS[key]={'email':email,'expires':time.time()+28800}
                secure='; Secure' if self.headers.get('X-Forwarded-Proto')=='https' else ''
                return self.send_json({'success':True,'token':key},cookie=f'nimelssa_session={key}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800{secure}')
            if path=='/api/logout':
                cookie=SimpleCookie();cookie.load(self.headers.get('Cookie',''))
                if cookie.get('nimelssa_session'):SESSIONS.pop(cookie['nimelssa_session'].value,None)
                auth=self.headers.get('Authorization','')
                if auth.startswith('Bearer '):SESSIONS.pop(auth[7:].strip(),None)
                return self.send_json({'success':True},cookie='nimelssa_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
            if path=='/api/newsletter':
                if self.limited('newsletter'):return
                for key in ['registration','department','email']:
                    if not str(obj.get(key,'')).strip():raise ValueError('Please fill all required fields.')
                email=str(obj['email']).strip().lower()
                if '@' not in email or len(email)>254:raise ValueError('Please enter a valid email address.')
                record={k:str(obj[k]).strip()[:300] for k in ['registration','department','email']};record['consent']=bool(obj.get('consent'));record['createdAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
                if not record['consent']:raise ValueError('Consent is required to subscribe.')
                with db() as c:c.execute('INSERT OR REPLACE INTO subscribers VALUES(?,?,?)',(email,json.dumps(record),time.time()))
                return self.send_json({'success':True,'message':'Your subscription has been saved. Email delivery will begin when the newsletter service is connected.'})
            if path in ['/api/marketplace','/api/questions','/api/replies']:
                if self.limited('submission',12):return
                kind={'/api/marketplace':'marketplace','/api/questions':'topics','/api/replies':'replies'}[path]
                required={'marketplace':['name','category','price','description','contactPhone'],'topics':['name','email','category','title','content'],'replies':['name','email','content','topicId']}[kind]
                for key in required:
                    if not str(obj.get(key,'')).strip():raise ValueError('Please fill all required fields.')
                if kind=='marketplace':
                    obj['price']=float(obj['price'])
                    if obj['price']<0 or obj['price']>1e12:raise ValueError('Enter a valid price.')
                if kind in ['topics','replies']:
                    if '@' not in obj['email']:raise ValueError('Enter a valid email.')
                    obj['privateName']=obj['name']
                    if obj.get('anonymous'):obj['name']='Anonymous student'
                uploaded=self.save_upload(obj)
                if uploaded:
                    if not uploaded.endswith(('.jpg','.png','.webp')):raise ValueError('A listing requires an image, not a PDF.')
                    obj['image']=uploaded
                # Only an explicit schema enters moderation; arbitrary client fields are discarded.
                allowed={'id','name','category','price','description','contactPhone','contactWhatsApp','image','email','privateName','anonymous','title','content','topicId','createdAt'}
                obj={k:v for k,v in obj.items() if k in allowed}
                if kind=='replies' and not any(v.get('id')==obj['topicId'] for v in payload().get('topics',[])):raise ValueError('Topic not found.')
                if any(isinstance(v,str) and len(v)>15000 for v in obj.values()):raise ValueError('Your submission is too long.')
                obj['id']=uuid.uuid4().hex;obj['createdAt']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
                with db() as c:c.execute('INSERT INTO submissions VALUES(?,?,?,?,?)',(obj['id'],kind,json.dumps(obj),'pending',time.time()))
                return self.send_json({'success':True,'message':'Submitted for review. It will appear after an administrator approves it.'},201)
            if path=='/api/admin/team':
                if not self.authorized():return
                email=str(obj.get('email','')).strip().lower()
                if '@' not in email or len(email)>254:raise ValueError('Enter a valid administrator email.')
                with db() as c:
                    if obj.get('action')=='delete':
                        if email==self.session()['email']:raise ValueError('You cannot remove your own account.')
                        if c.execute('SELECT COUNT(*) FROM admins').fetchone()[0]<2:raise ValueError('At least one administrator must remain.')
                        c.execute('DELETE FROM admins WHERE email=?',(email,))
                        for key in list(SESSIONS):
                            if SESSIONS[key]['email']==email:SESSIONS.pop(key,None)
                    else:
                        password=str(obj.get('password',''))
                        if len(password)<12:raise ValueError('Use at least 12 characters for the password.')
                        if c.execute('SELECT 1 FROM admins WHERE email=?',(email,)).fetchone():raise ValueError('An administrator with that email already exists.')
                        salt=secrets.token_hex(24)
                        c.execute('INSERT INTO admins VALUES(?,?,?)',(email,salt,password_hash(password,salt)))
                return self.send_json({'success':True})
            if path=='/api/admin/save':
                if not self.authorized():return
                kind=obj.get('kind');record=obj.get('record',{})
                if kind not in COLLECTIONS+OBJECTS or not isinstance(record,dict):raise ValueError('Invalid content type.')
                uploaded=self.save_upload(record)
                if uploaded:record['fileUrl' if kind in ['documents','past-questions'] else 'image']=uploaded
                record={k:v for k,v in record.items() if not str(k).startswith('_')}
                with db() as c:
                    if kind in OBJECTS:value=record
                    else:
                        row=c.execute('SELECT body FROM content WHERE kind=?',(kind,)).fetchone();value=json.loads(row[0]) if row else []
                        record['id']=record.get('id') or uuid.uuid4().hex
                        value=[r for r in value if r.get('id')!=record['id']];value.append(record)
                    c.execute('INSERT OR REPLACE INTO content VALUES(?,?)',(kind,json.dumps(value)))
                return self.send_json({'success':True})
            if path=='/api/admin/delete':
                if not self.authorized():return
                kind=obj.get('kind');id=obj.get('id')
                if kind not in COLLECTIONS:raise ValueError('Invalid content type.')
                with db() as c:
                    row=c.execute('SELECT body FROM content WHERE kind=?',(kind,)).fetchone();value=json.loads(row[0]) if row else [];value=[r for r in value if r.get('id')!=id]
                    c.execute('INSERT OR REPLACE INTO content VALUES(?,?)',(kind,json.dumps(value)))
                return self.send_json({'success':True})
            if path=='/api/admin/moderate':
                if not self.authorized():return
                with db() as c:
                    row=c.execute('SELECT * FROM submissions WHERE id=?',(str(obj.get('id','')),)).fetchone()
                    if not row or row['status']!='pending':raise ValueError('Submission not found or already reviewed.')
                    approved=obj.get('action')=='approve'
                    if approved:
                        current=c.execute('SELECT body FROM content WHERE kind=?',(row['kind'],)).fetchone();records=json.loads(current[0]) if current else [];record=json.loads(row['body']);records.append(record)
                        c.execute('INSERT OR REPLACE INTO content VALUES(?,?)',(row['kind'],json.dumps(records)))
                    c.execute('UPDATE submissions SET status=? WHERE id=?',('approved' if approved else 'rejected',row['id']))
                return self.send_json({'success':True})
            return self.send_json({'error':'Not found'},404)
        except (ValueError,TypeError,KeyError) as e:return self.send_json({'error':str(e)},400)
        except Exception as e:
            print('Server error:',type(e).__name__,flush=True);return self.send_json({'error':'Unable to save right now. Please try again.'},500)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=int(os.environ.get('PORT',3000)));parser.add_argument('--create-admin',metavar='EMAIL');args=parser.parse_args();init()
    if args.create_admin:
        password=getpass.getpass('New administrator password (12+ characters): ')
        if len(password)<12:raise SystemExit('Use at least 12 characters.')
        if password!=getpass.getpass('Confirm password: '):raise SystemExit('Passwords do not match.')
        salt=secrets.token_hex(24)
        with db() as c:c.execute('INSERT OR REPLACE INTO admins VALUES(?,?,?)',(args.create_admin.lower().strip(),salt,password_hash(password,salt)))
        print('Administrator configured.');raise SystemExit
    print(f'NIMELSSA website listening on 0.0.0.0:{args.port}',flush=True)
    ThreadingHTTPServer(('0.0.0.0',args.port),Handler).serve_forever()
