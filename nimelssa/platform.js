'use strict';
(() => {
const $ = (s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL = value => { const s=String(value??'').trim();return s.startsWith('/')&&!s.startsWith('//')||/^(https?:\/\/|mailto:|tel:)/i.test(s)?s:'#'; };
const e = escape;
const internal=(page,id)=>`/pages/${({faculty:'about',departments:'department'})[page]||page}${id?'?id='+encodeURIComponent(id):''}`;
const dateString=value=>{if(!value)return '';const stamp=typeof value==='object'?value._seconds*1000:value;const d=new Date(stamp);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'});};
const initial=name=>String(name||'N').split(/\s+/).filter(Boolean).slice(0,2).map(n=>n[0]).join('').toUpperCase();
const image=(src,alt,cls='')=>src?`<img src="${e(safeURL(src))}" alt="${e(alt)}" class="${e(cls)}" loading="lazy">`:`<div class="initial-avatar ${e(cls)}">${e(initial(alt))}</div>`;
const empty=(title,copy,action='')=>`<div class="empty-panel"><span>✳</span><h2>${e(title)}</h2><p>${e(copy)}</p>${action}</div>`;
const button=(label,action,color='green-button')=>`<button type="button" class="button ${color}" data-action="${e(action)}">${e(label)} <span>↗</span></button>`;
const linkButton=(label,url,color='green-button')=>`<a class="button ${color}" href="${e(safeURL(url))}">${e(label)} <span>↗</span></a>`;
// Dispatch validated form handlers explicitly so embedded previews without allow-forms work.
if(!window.__NIMELSSA_FORM_HANDLERS){
 window.__NIMELSSA_FORM_HANDLERS=true;
 document.addEventListener('click',event=>{const submit=event.target.closest('button[type="submit"],input[type="submit"]');if(!submit||!submit.form||submit.disabled)return;event.preventDefault();const form=submit.form;if(form.reportValidity())form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));},true);
 document.addEventListener('keydown',event=>{if(event.key!=='Enter'||event.target.tagName!=='INPUT'||!event.target.form)return;const submit=event.target.form.querySelector('button[type="submit"]');if(submit){event.preventDefault();submit.click();}},true);
}
const page=document.body.dataset.page;
let content={},filter={q:'',category:'',level:'',sort:'newest'},galleryLimit=24,currentAdminTab='overview',adminData=null;
const main=$('#page-content');
const apiBase=String(window.NIMELSSA_API_URL||((location.hostname==='localhost'||location.hostname==='127.0.0.1')?'http://localhost:5000/api/nimelssa':'https://facultyportalwebsite-3.onrender.com/api/nimelssa')).replace(/\/+$/,'');
const backendOrigin=new URL(apiBase).origin;
let firebaseClientPromise;
const menu=$('.menu-toggle'),nav=$('#navigation');
function closeNav(){nav?.classList.remove('open');menu?.setAttribute('aria-expanded','false');if(menu){menu.textContent='☰';menu.setAttribute('aria-label','Open navigation');}}
menu?.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.textContent=open?'✕':'☰';menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');});
$$('.nav-dropdown').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)$$('.nav-dropdown').forEach(other=>{if(other!==d)other.open=false;});}));
document.addEventListener('click',ev=>{if(!ev.target.closest('.header')){closeNav();$$('.nav-dropdown').forEach(d=>d.open=false);}});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){closeNav();$$('.nav-dropdown').forEach(d=>d.open=false);}});
$$('#navigation a').forEach(a=>{if(a.pathname===location.pathname)a.classList.add('is-current');});
const year=$('#copyright-year');if(year)year.textContent=new Date().getFullYear();
let toastTimer;function toast(message){let el=$('#toast');if(!el){el=document.createElement('div');el.id='toast';el.className='toast';el.setAttribute('role','status');document.body.append(el);}el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,5000);}
let sessionToken='';
try{sessionToken=sessionStorage.getItem('nimelssa_admin_session')||'';}catch{}
function saveSession(token){sessionToken=token||'';try{if(token)sessionStorage.setItem('nimelssa_admin_session',token);else sessionStorage.removeItem('nimelssa_admin_session');}catch{}}
async function firebaseClient(){
 if(!firebaseClientPromise)firebaseClientPromise=Promise.all([
  import(`${backendOrigin}/assets/js/firebase-config.js`),
  import('https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js')
 ]).then(([config,authSdk])=>({auth:config.auth,...authSdk}));
 return firebaseClientPromise;
}
async function currentFirebaseUser(client){
 return new Promise(resolve=>{let unsubscribe;unsubscribe=client.onAuthStateChanged(client.auth,user=>{unsubscribe();resolve(user);});});
}
async function requestToken(){
 if(!sessionToken)return '';
 const client=await firebaseClient(),user=await currentFirebaseUser(client);
 if(user){sessionToken=await user.getIdToken();saveSession(sessionToken);}
 return sessionToken;
}
async function uploadMedia(upload,adminUpload,signal){
 const binary=Uint8Array.from(atob(upload.data),character=>character.charCodeAt(0));
 const file=new File([binary],upload.name||'upload',{type:upload.type||'application/octet-stream'});
 const form=new FormData();form.append('image',file);form.append('folder','nimelssa');
 const headers={},token=adminUpload?await requestToken():'';
 if(token)headers.Authorization='Bearer '+token;
 const response=await fetch(`${backendOrigin}/api/upload/${adminUpload?'nimelssa':'nimelssa-submission'}`,{method:'POST',headers,body:form,credentials:'omit',signal});
 let result;try{result=await response.json();}catch{throw Error('The shared media service returned an unreadable response.');}
 if(!response.ok)throw Error(result.error||'Unable to upload this file to shared storage.');
 if(result.storage!=='s3'&&result.storage!=='firebase')throw Error('The shared media service did not confirm remote storage.');
 return result.url;
}
async function api(path,body){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
 try{
  if(path==='/api/login'&&body){
   const client=await firebaseClient(),result=await client.signInWithEmailAndPassword(client.auth,body.email,body.password);
   sessionToken=await result.user.getIdToken();saveSession(sessionToken);
   return {success:true,token:sessionToken};
  }
  if(path==='/api/logout'){
   const client=await firebaseClient();await client.signOut(client.auth);saveSession('');
   return {success:true};
  }
  let payload=body;
  if(payload?.record?.upload){
   const record={...payload.record},upload=record.upload;delete record.upload;
   const url=await uploadMedia(upload,true,controller.signal);
   record[['documents','past-questions'].includes(payload.kind)?'fileUrl':'image']=url;
   payload={...payload,record};
  }else if(payload?.upload){
   const upload=payload.upload,url=await uploadMedia(upload,false,controller.signal);
   payload={...payload,image:url};delete payload.upload;
  }
  const headers=payload?{'Content-Type':'application/json'}:{},token=await requestToken();
  if(token)headers.Authorization='Bearer '+token;
  const target=path.startsWith('/api/upload/')?`${backendOrigin}${path}`:`${apiBase}${path.replace(/^\/api(?=\/)/,'')}`;
  const response=await fetch(target,{method:payload?'POST':'GET',credentials:'omit',headers,body:payload?JSON.stringify(payload):undefined,signal:controller.signal});
  let data;try{data=await response.json();}catch{throw Error('The application server is not available. Open the live website preview to sign in.');}
  if(!response.ok)throw Error(data.error||'Unable to complete your request.');return data;
 }catch(err){if(err.name==='AbortError')throw Error('The server took too long to respond. Please try again in the live website preview.');throw err;}
 finally{clearTimeout(timer);}
}
async function loadContent(){
 try{
  const remote=await api('/api/content'),initialized=remote._initialized===true;delete remote._initialized;
  if(initialized){content=remote;return content;}
 }catch{}
 const response=await fetch('/data/seed.json');if(!response.ok)throw Error('Content is temporarily unavailable. Please try again.');
 content=await response.json();return content;
}
function topLine(title,count,action=''){return `<div class="page-topline"><h2>${e(title)}</h2><span class="result-count" id="result-count">${e(count)}</span>${action}</div>`;}
function toolbar(placeholder,options=[],level=false,sort=false){return `<div class="page-toolbar"><label class="filter-search"><span aria-hidden="true">⌕</span><input type="search" id="page-search" aria-label="Search this page" placeholder="${e(placeholder)}" value="${e(filter.q)}"></label>${options.length?`<select id="category-filter" aria-label="Filter by category"><option value="">${page==='gallery'?'All events':page==='past-questions'?'All subjects':page==='leaders'||page==='parliamentarians'?'All departments':'All categories'}</option>${options.map(v=>`<option value="${e(v)}">${e(v)}</option>`).join('')}</select>`:''}${level?'<select id="level-filter" aria-label="Filter by level"><option value="">All levels</option><option value="100">100 Level</option><option value="200">200 Level</option><option value="300">300 Level</option><option value="400">400 Level</option><option value="500">500 Level</option><option value="600">600 Level</option></select>':''}${sort?'<select id="sort-filter" aria-label="Sort listings"><option value="newest">Newest first</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select>':''}</div>`;}
function unique(rows,key){return [...new Set(rows.map(x=>String(x[key]??'').trim()).filter(Boolean))].sort();}
function searchRows(rows){return rows.filter(row=>`${row.name||''} ${row.title||''} ${row.event||''} ${row.fileName||''} ${row.position||''} ${row.department||''} ${row.description||''} ${row.subject||''}`.toLowerCase().includes(filter.q.toLowerCase().trim()));}
function bindFilters(){['page-search','category-filter','level-filter','sort-filter'].forEach(id=>{const el=$('#'+id);if(el)el.addEventListener(id==='page-search'?'input':'change',()=>{filter[id==='page-search'?'q':id==='category-filter'?'category':id==='level-filter'?'level':'sort']=el.value;galleryLimit=24;renderResults();});});}
function setResults(html,count,suffix){$('#results').innerHTML=html;const el=$('#result-count');if(el)el.textContent=`${count} ${suffix}`;}
function renderResults(){
 const data=content[page]||[];
 if(['leaders','parliamentarians'].includes(page)){
  let rows=searchRows(data).filter(r=>!filter.category||String(r.department||'').trim()===filter.category);
  rows.sort((a,b)=>(a.order??100)-(b.order??100));
  if(page==='leaders')rows.sort((a,b)=>(/^(president|executive president)$/i.test(b.position?.trim())?1:0)-(/^(president|executive president)$/i.test(a.position?.trim())?1:0));
  setResults(rows.length?`<div class="people-grid">${rows.map(r=>`<a class="person-card" href="${internal(page==='leaders'?'leader-detail':'parliamentarian-detail',r.id)}"><div class="person-portrait">${image(r.photoUrl||r.image,r.name)}<span class="portrait-arrow">↗</span></div><div class="person-info"><p class="role">${e(r.position)}</p><h3>${e(r.name)}</h3><p>${e(r.department)}</p></div></a>`).join('')}</div>`:empty(data.length?'NO MATCHES THIS TIME.':'No profiles published yet.',data.length?'Try another name.':'Approved NIMELSSA profiles will appear here when published by the association.'),rows.length,'representatives');
 }
 if(page==='departments'){
  const rows=searchRows(data);setResults(rows.length?`<div class="department-grid">${rows.map((r,i)=>`<a class="department-card" href="${internal('department-detail',r.id)}"><span class="number">0${i+1} / EXPLORE</span><h3>${e(r.name)}</h3><p>${e(r.description)}</p><span>↗</span></a>`).join('')}</div>`:empty('NO DEPARTMENTS FOUND.','Try a different search.'),rows.length,'departments');
 }
 if(page==='gallery'){
  const rows=searchRows(data).filter(r=>!filter.category||String(r.event||'').trim()===filter.category);const shown=rows.slice(0,galleryLimit);
  setResults(rows.length?`<div class="gallery-grid">${shown.map(r=>`<a class="gallery-card" href="${internal('gallery-detail',r.id)}"><div>${image(r.photoUrl||r.image,r.event)}</div><h3>${e(r.event)}</h3><p>${e(dateString(r.date))} <span>↗</span></p></a>`).join('')}</div>${rows.length>shown.length?`<div class="more-button">${button('Load more moments','more-gallery')}</div>`:''}`:empty(data.length?'NO MOMENTS FOUND.':'No department photos yet.',data.length?'Choose a different event or search term.':'Approved photos from NIMELSSA activities will appear here. Illustrative lab imagery on the homepage is not an event record.'),rows.length,'photographs');
 }
 if(page==='archive'){
  const rows=searchRows(data);setResults(rows.length?`<div class="archive-grid">${rows.map(r=>`<article class="story-card"><a href="${internal('archive-detail',r.id)}">${r.image?image(r.image,r.title):'<div class="story-cover-placeholder">✳</div>'}</a><div class="story-copy"><p class="meta">COMMUNITY ARCHIVE ${dateString(r.date)?'· '+e(dateString(r.date)):''}</p><h3><a href="${internal('archive-detail',r.id)}">${e(r.title)}</a></h3><p>${e(r.description)}</p><a class="text-link" href="${internal('archive-detail',r.id)}">Read the story <span>↗</span></a></div></article>`).join('')}</div>`:empty(data.length?'NO STORIES FOUND.':'No announcements published yet.',data.length?'Try a different search.':'Association stories and departmental milestones will appear when published.'),rows.length,'stories');
 }
 if(['documents','past-questions'].includes(page)){
  const rows=searchRows(data).filter(r=>(!filter.category||String(page==='past-questions'?r.subject||'':r.category||'').trim()===filter.category)&&(!filter.level||String(r.semester||r.level||'')===filter.level));
  setResults(rows.length?`<div class="resource-list">${rows.map(r=>`<article class="document-row"><span class="doc-icon">${page==='documents'?'DOC':'STUDY'}</span><div class="document-copy"><h3>${e(r.fileName||r.title)}</h3><p>${e(r.subject||r.category||'Department resource')}${r.semester?' · '+e(r.semester)+' Level':''}${r.description?' · '+e(r.description):''}</p></div><a class="button green-button" href="${e(safeURL(r.fileUrl))}" target="_blank" rel="noopener noreferrer">Open resource <span>↗</span></a></article>`).join('')}</div>`:empty(data.length?'NO RESOURCES FOUND.':'No documents published yet.',data.length?'Try a different subject, category or level.':'Approved departmental documents will appear here when published.'),rows.length,'resources');
 }
 if(page==='marketplace'){
  let rows=searchRows(data).filter(r=>!filter.category||String(r.category||'').trim()===filter.category);
  if(filter.sort==='low')rows.sort((a,b)=>Number(a.price)-Number(b.price));else if(filter.sort==='high')rows.sort((a,b)=>Number(b.price)-Number(a.price));else rows.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
  setResults(rows.length?`<div class="market-grid">${rows.map(r=>`<article class="market-card"><a href="${internal('marketplace-detail',r.id)}">${r.image?image(r.image,r.name):'<div class="story-cover-placeholder">↗</div>'}</a><div class="market-copy"><p class="meta">${e(r.category||'Student listing')}</p><h3><a href="${internal('marketplace-detail',r.id)}">${e(r.name)}</a></h3><p>${e(String(r.description||'').slice(0,140))}</p><div class="price">₦${Number(r.price||0).toLocaleString('en-NG')}</div><a class="text-link" href="${internal('marketplace-detail',r.id)}">View listing <span>↗</span></a></div></article>`).join('')}</div>`:empty('YOUR NEXT FIND STARTS HERE.','There are no matching listings. You can submit an item for administrator review.',button('Sell an item','sell')),rows.length,'listings');
 }
}
function listingPage(){
 const data=content[page]||[];const titles={leaders:'NIMELSSA EXECUTIVE TEAM',parliamentarians:'OUR STUDENT REPRESENTATIVES',departments:'OUR DEPARTMENT',gallery:'Department photos',archive:'News and past events',documents:'Department documents','past-questions':'Study materials',marketplace:'THE STUDENT MARKETPLACE'};
 const category=['leaders','parliamentarians'].includes(page)?[]:page==='gallery'?unique(data,'event'):page==='documents'||page==='marketplace'?unique(data,'category'):page==='past-questions'?unique(data,'subject'):[];
 main.innerHTML=`${topLine(titles[page],`${data.length} items`,page==='marketplace'?button('Sell an item','sell'):'' )}${page==='marketplace'?'<div class="content-note">Meet in a public place, inspect items before paying and never send advance payments to unknown sellers. Listings are student-submitted, not university endorsements.</div>':''}${page==='past-questions'?'<p class="content-note">Study-support materials for MLS and the supporting sciences. Confirm relevance, course codes and current requirements with your lecturers; this is not an official curriculum.</p>':''}${toolbar(page==='past-questions'?'Search by course, subject or title…':'Search '+page.replace('-',' ')+'…',category,page==='past-questions',page==='marketplace')}<div id="results"></div>`;
 renderResults();bindFilters();
}
function facultyPage(){const f=content.faculty||{};main.innerHTML=`<div class="faculty-layout"><div><p class="eyebrow">NIMELSSA · UNIVERSITY OF UYO</p><h2>About NIMELSSA<br><span class="green">at UNIUYO</span></h2><p class="association-full-name">${e(f.name)}</p><p class="prose">${e(f.content)}</p><dl class="association-facts"><div><dt>Association</dt><dd>NIMELSSA UNIUYO</dd></div><div><dt>Department</dt><dd>Medical Laboratory Science</dd></div><div><dt>University</dt><dd>University of Uyo</dd></div></dl><div class="detail-actions">${linkButton('Explore our department',internal('departments'))}${linkButton('Student leadership',internal('leaders'),'white')}</div></div><aside class="faculty-aside"><div><p class="eyebrow">PURPOSE</p><h3>What this site is for</h3><p>${e(f.mission)}</p></div><div><p class="eyebrow">INFORMATION</p><h3>Keeping information useful</h3><p>${e(f.vision)}</p></div></aside></div><div class="section-title-row"><h2>Useful links</h2></div><div class="department-grid"><a class="department-card" href="${internal('past-questions')}"><span class="number">LEARN</span><h3>Browse study materials</h3><p>Browse materials for Medical Laboratory Science and the supporting sciences.</p><span>↗</span></a><a class="department-card" href="${internal('companion')}"><span class="number">CONNECT</span><h3>Ask a study question</h3><p>Ask a question, share your experience and learn with your student community.</p><span>↗</span></a></div>`;}
function departmentPage(){
const dept=(content.departments||[])[0]||{};
const disciplines=[['Clinical Chemistry','Exploring the chemical constituents of body fluids and the principles behind biochemical investigation.'],['Haematology','Studying blood cells, their development and the laboratory principles used to understand blood disorders.'],['Medical Microbiology','Exploring microorganisms, infection and the laboratory approaches used to study them.'],['Histopathology','Understanding cells and tissues, specimen preparation and the microscopic study of tissue changes.'],['Immunology & Serology','Learning about immune responses and the principles behind antigen and antibody testing.'],['Transfusion Science','Exploring blood groups, compatibility and the principles behind safe blood transfusion practice.']];
main.innerHTML=`<div class="faculty-layout"><div><p class="eyebrow">UNIVERSITY OF UYO</p><h2>Medical Laboratory<br><span class="green">Science</span></h2><p class="prose">${e(dept.description||'Medical Laboratory Science brings scientific observation, laboratory methods and analytical thinking together to support an understanding of health and disease.')}</p><p class="muted">NIMELSSA UNIUYO is the association at the heart of our student community: connecting people, sharing academic support and creating space to grow beyond the classroom.</p><div class="detail-actions">${linkButton('Browse study resources',internal('past-questions'))}${linkButton('About NIMELSSA',internal('faculty'),'white')}</div></div><div class="mls-department-photo">${image('/assets/mls-laboratory.jpg','Illustrative Medical Laboratory Science teaching laboratory')}<span>PRECISION. PURPOSE. PEOPLE.</span></div></div><div class="section-title-row"><div><p class="eyebrow">EXPLORE THE SCIENCE</p><h2>Disciplines you may<br>come across</h2></div></div><p class="muted">An introduction to fields within medical laboratory science. This is not an official curriculum, course schedule or list of departmental units.</p><div class="mls-discipline-grid">${disciplines.map(([title,copy],i)=>`<article class="mls-discipline-card"><span>0${i+1} / THE SCIENCE</span><h3>${e(title)}</h3><p>${e(copy)}</p></article>`).join('')}</div><div class="support-banner" style="margin-top:35px;margin-bottom:0"><div><p class="eyebrow yellow-text">STUDY QUESTIONS</p><h2>Have a study question?</h2><p>Ask the student community if you cannot find a resource or need help getting started with a subject.</p></div>${linkButton('Academic companion',internal('companion'),'yellow')}</div>`;
}
function notFound(back='faculty'){main.innerHTML=empty('WE COULDN’T FIND THAT.','The item may have been removed or is not published yet.',linkButton('Back to the community',internal(back)));}
function detailPage(){
 const id=new URLSearchParams(location.search).get('id');const type={'leader-detail':'leaders','parliamentarian-detail':'parliamentarians','department-detail':'departments','gallery-detail':'gallery','archive-detail':'archive','marketplace-detail':'marketplace','companion-detail':'topics'}[page];
 const rows=content[type]||[];const r=rows.find(v=>v.id===id);if(!r)return notFound(type==='topics'?'companion':type);
 const back=type==='topics'?'companion':type;
 let html=`<a class="back-link" href="${internal(back)}">← Back to ${e(back.replace('-',' '))}</a>`;
 if(['leaders','parliamentarians'].includes(type))html+=`<div class="detail-layout"><div>${image(r.photoUrl||r.image,r.name,'detail-image')}</div><div class="detail-copy"><p class="eyebrow">${e(r.position)}</p><h2>${e(r.name)}</h2><div class="detail-tags"><span class="tag">${e(r.department)}</span><span class="tag">STUDENT REPRESENTATIVE</span></div><p class="prose">${e(r.bio||r.portfolio||'Serving our student community through leadership and representation.')}</p>${r.achievements?.length?`<h3>Achievements</h3><ul>${r.achievements.map(v=>`<li>${e(v)}</li>`).join('')}</ul>`:''}<div class="detail-facts"><div><strong>POSITION</strong><span>${e(r.position)}</span></div><div><strong>DEPARTMENT</strong><span>${e(r.department)}</span></div></div><div class="detail-actions">${r.email?linkButton('Send an email','mailto:'+r.email):''}${r.phone?linkButton('Call representative','tel:'+r.phone,'white'):''}</div><p class="fine-print">Profiles are published by the association. Contact details are shown only when supplied for publication.</p></div></div>`;
 if(type==='departments'){
  const leaders=(content.leaders||[]).filter(v=>String(v.department).toLowerCase().includes(r.name.split(' ')[0].toLowerCase()));
  html+=`<div class="faculty-layout"><div><p class="eyebrow">OUR DEPARTMENT</p><h2>${e(r.name)}</h2><p class="prose">${e(r.description)}</p><p class="muted">Find useful study resources, connect with your representatives and take your next step with academic support.</p><div class="detail-actions">${linkButton('Browse study materials',internal('past-questions'))}${linkButton('Academic companion',internal('companion'),'white')}</div></div><aside class="faculty-aside"><p class="eyebrow">STUDENT RESOURCES</p><h3>Departmental information</h3><p>Access departmental documents, stay informed through the newsletter and discover opportunities to connect.</p>${linkButton('Explore documents',internal('documents'),'yellow')}</aside></div><div class="section-title-row"><h2>PEOPLE IN YOUR COMMUNITY</h2></div>${leaders.length?`<div class="people-grid">${leaders.map(v=>`<a class="person-card" href="${internal('leader-detail',v.id)}"><div class="person-portrait">${image(v.photoUrl||v.image,v.name)}</div><div class="person-info"><p class="role">${e(v.position)}</p><h3>${e(v.name)}</h3></div></a>`).join('')}</div>`:empty('No profiles published yet.','Approved student profiles will appear here when the association publishes them.',linkButton('Meet our leaders',internal('leaders')))}`;
 }
 if(type==='gallery'){
  const idx=rows.indexOf(r);html+=`${image(r.photoUrl||r.image,r.event,'gallery-detail-photo')}<div class="gallery-detail-nav">${idx>0?`<a href="${internal('gallery-detail',rows[idx-1].id)}">← Previous photo</a>`:'<span></span>'}<span class="result-count">${idx+1} / ${rows.length}</span>${idx<rows.length-1?`<a href="${internal('gallery-detail',rows[idx+1].id)}">Next photo →</a>`:'<span></span>'}</div><div class="section-title-row"><h2>${e(r.event)}</h2></div><p class="muted">${e(dateString(r.date))}</p><p class="prose">${e(r.description)}</p>`;
 }
 if(type==='archive')html+=`<article class="article">${r.image?image(r.image,r.title,'article-cover'):''}<p class="eyebrow">COMMUNITY ARCHIVE ${dateString(r.date)?'· '+e(dateString(r.date)):''}</p><h2>${e(r.title)}</h2><p class="lead">${e(r.description)}</p><div class="prose">${e(r.content)}</div><div class="detail-actions">${linkButton('Explore more stories',internal('archive'))}${linkButton('Browse event photos',internal('gallery'),'white')}</div></article>`;
 if(type==='marketplace'){
  const phone=String(r.contactPhone||'').replace(/[^+\d]/g,'');let wa=String(r.contactWhatsApp||'').replace(/\D/g,'');if(wa.startsWith('0'))wa='234'+wa.slice(1);
  html+=`<div class="detail-layout"><div>${r.image?image(r.image,r.name,'detail-image'):'<div class="story-cover-placeholder" style="height:340px;border-radius:10px">↗</div>'}</div><div class="detail-copy"><p class="eyebrow">${e(r.category)}</p><h2>${e(r.name)}</h2><div class="price">₦${Number(r.price||0).toLocaleString('en-NG')}</div><p class="prose">${e(r.description)}</p><div class="detail-actions">${phone?linkButton('Call seller','tel:'+phone):''}${wa?`<a class="button yellow" href="https://wa.me/${e(wa)}" target="_blank" rel="noopener noreferrer">WhatsApp seller <span>↗</span></a>`:''}</div><div class="content-note" style="margin-top:25px">Inspect the item before paying. Meet in a busy public place. Never share sensitive payment information or send deposits to an unknown seller.</div></div></div>`;
 }
 if(type==='topics'){
  const replies=(content.replies||[]).filter(v=>v.topicId===r.id);
  html+=`<article class="article"><div class="detail-tags"><span class="tag">${e(r.category)}</span><span class="tag">${e(r.name||'Anonymous student')}</span></div><h2>${e(r.title)}</h2><div class="prose">${e(r.content)}</div><p class="fine-print">Community replies are peer support, not professional medical or mental-health advice.</p><div class="section-title-row"><h2>Replies</h2>${button('Add a reply','reply')}</div>${replies.length?`<div class="topic-list">${replies.map(v=>`<div class="topic-card"><p class="meta">${e(v.name||'Anonymous student')} · ${e(dateString(v.createdAt))}</p><p class="prose">${e(v.content)}</p></div>`).join('')}</div>`:empty('No replies published yet.','Share constructive, respectful advice. Replies appear after administrator review.')}</article>`;
 }
 main.innerHTML=html;
}
function field(name,label,type='text',required=true,value='',options=[]){let input=type==='textarea'?`<textarea name="${e(name)}" ${required?'required':''}>${e(value)}</textarea>`:type==='select'?`<select name="${e(name)}" ${required?'required':''}><option value="">Select ${e(label.toLowerCase())}</option>${options.map(v=>`<option value="${e(v)}"${String(value)===v?' selected':''}>${e(v)}</option>`).join('')}</select>`:`<input name="${e(name)}" type="${e(type)}" ${required?'required':''} ${type==='file'?'accept="image/jpeg,image/png,image/webp"':`value="${e(value)}"`} ${type==='number'?'min="0" step="any"':''} ${type==='password'?'autocomplete="current-password"':''}>`;return `<label class="field ${type==='textarea'?'full':''}"><span>${e(label)}${required?' *':''}</span>${input}</label>`;}
function newsletterPage(){
 main.innerHTML=`<div class="form-layout"><div class="form-intro"><p class="eyebrow">REGISTRATION</p><h2>Register for<br><span class="green">association updates</span></h2><p>Enter your details below if you would like association updates.</p><ul class="benefits"><li>Department news and announcements</li><li>Academic events and workshops</li><li>Departmental news and achievements</li><li>Opportunities and scholarships</li><li>Stories from our community</li></ul><a class="text-link" href="${internal('newsletter')}">Browse published updates <span>↗</span></a></div><form class="form-panel" id="newsletter-form"><h3>Your details</h3><div class="form-grid">${field('registration','Registration number')}${field('department','Department','select',true,'Medical Laboratory Science',(content.departments||[]).map(r=>r.name))}<div class="full">${field('email','Email address','email')}</div><label class="consent full"><input type="checkbox" name="consent" required><span>I agree to my registration number, department and email being stored for community newsletter updates.</span></label><p class="form-error full" role="alert"></p><p class="form-message full" role="status"></p><button class="button green-button full" type="submit">Subscribe to updates <span>↗</span></button></div><p class="fine-print">Your subscription is stored by this website. Automatic email delivery is not connected yet. We won’t claim to have sent an email.</p></form></div>`;
 $('#newsletter-form').addEventListener('submit',async ev=>{ev.preventDefault();const f=ev.currentTarget;const data=Object.fromEntries(new FormData(f));data.consent=!!data.consent;await submitForm(f,'/api/newsletter',data);});
}
const categories=['Academic Issues','Career Guidance','Personal Development','Mental Wellness','Project Guidance','Skill Development'];
function companionPage(){
 const topics=content.topics||[],faqs=content.faq||[],advisors=content.advisors||[];
 main.innerHTML=`<div class="support-banner"><div><p class="eyebrow yellow-text">COMMUNITY QUESTIONS</p><h2>Ask about your studies</h2><p>Post your question for peer support. Please don’t include private medical information. Questions and replies are reviewed before publication.</p></div>${button('Ask a question','question','yellow')}</div><div class="chip-row">${categories.map(c=>`<button class="filter-chip" data-companion-category="${e(c)}">${e(c)}</button>`).join('')}</div><div class="section-title-row"><h2>Student questions</h2><span class="result-count">${topics.length} topics</span></div><div id="topic-results">${topicCards(topics)}</div><div class="section-title-row"><h2>Advisors</h2></div>${advisors.length?`<div class="people-grid">${advisors.map(r=>`<div class="person-card"><div class="person-portrait">${image(r.image||r.photoUrl,r.name)}</div><div class="person-info"><p class="role">${e(r.specialty||r.role)}</p><h3>${e(r.name)}</h3><p>${e(r.bio)}</p></div></div>`).join('')}</div>`:empty('No advisors listed yet.','No advisors have been published yet. For urgent concerns, contact a qualified professional or the university support team.')}<div class="section-title-row"><h2>Questions about using this site</h2></div>${faqs.length?`<div class="faq-list">${faqs.map(r=>`<details><summary>${e(r.question||r.title)}</summary><p>${e(r.answer||r.content)}</p></details>`).join('')}</div>`:empty('No help articles published yet.','The editorial team has not published FAQ resources yet. You can submit a question above.')}<p class="fine-print">If you are in immediate danger or experiencing a medical emergency, seek local emergency assistance. This community platform is not an emergency or clinical service.</p>`;
}
function topicCards(rows){return rows.length?`<div class="topic-list">${rows.map(r=>`<a class="topic-card" href="${internal('companion-detail',r.id)}"><span class="tag">${e(r.category)}</span><h3>${e(r.title)}</h3><p>${e(String(r.content||'').slice(0,180))}</p><p class="meta" style="margin-top:12px">${e(r.name||'Anonymous student')} · ${e(dateString(r.createdAt))} ↗</p></a>`).join('')}</div>`:empty('No published questions yet.','No published topics here yet. Ask a question and help build a supportive community.',button('Ask a question','question'));}
function socialsPage(){const settings=content.settings||{},socials=content.socials||[],department=content['department-socials']||[];const card=r=>`<a class="social-card" href="${e(safeURL(r.url))}" target="_blank" rel="noopener noreferrer"><span class="social-symbol">${e(initial(r.platform))}</span><div><h3>${e(r.name||r.platform)}</h3><p>${e(r.handle||r.platform)}</p></div><span>↗</span></a>`;
 main.innerHTML=`${topLine('Contact NIMELSSA',`${socials.length} community channels`)}${socials.length?`<div class="contact-grid">${socials.map(card).join('')}</div>`:empty('No official channels listed.','Official social channels will appear here when published.')}<div class="section-title-row"><h2>DEPARTMENT CHANNELS</h2></div>${department.length?`<div class="contact-grid">${department.map(card).join('')}</div>`:empty('No additional channels listed.','Department social channels have not been published yet.')}<section class="contact-panel"><h3>Contact details</h3><div class="contact-line"><strong>LOCATION</strong><span>${e(settings.location||'University of Uyo')}</span></div><div class="contact-line"><strong>EMAIL</strong>${settings.email?`<a href="mailto:${e(settings.email)}">${e(settings.email)}</a>`:'<span>Official contact to be confirmed</span>'}</div><div class="contact-line"><strong>PHONE</strong>${settings.phone?`<a href="tel:${e(settings.phone)}">${e(settings.phone)}</a>`:'<span>Official contact to be confirmed</span>'}</div><div class="detail-actions">${linkButton('Newsletter updates',internal('newsletter-login'))}</div></section>`;}
function newslettersPage(){const rows=content.newsletter||[];main.innerHTML=`${topLine('Association announcements',`${rows.length} published updates`,linkButton('Subscribe',internal('newsletter-login')))}${rows.length?`<div class="newsletter-cards">${rows.map(r=>`<article class="newsletter-card"><span class="tag">${e(dateString(r.date))}</span><h3>${e(r.title)}</h3><p class="prose">${e(r.content)}</p></article>`).join('')}</div>`:empty('No announcements published yet.','No newsletter editions have been published yet. Register to receive future community updates.',linkButton('Register for updates',internal('newsletter-login')))}`;}
async function readUpload(file){if(!file||!file.size)return null;if(file.size>8*1024*1024)throw Error('Choose a file smaller than 8 MB.');return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({name:file.name,type:file.type,data:String(reader.result).split(',')[1]});reader.onerror=()=>reject(Error('Unable to read that file.'));reader.readAsDataURL(file);});}
function modal(title,body,onSubmit){let dialog=$('#site-dialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='site-dialog';dialog.className='site-dialog';document.body.append(dialog);}dialog.innerHTML=`<div class="dialog-header"><h2>${e(title)}</h2><button type="button" class="dialog-close" aria-label="Close dialog">✕</button></div>${body}`;$('.dialog-close',dialog).addEventListener('click',()=>dialog.close());dialog.onclick=ev=>{if(ev.target===dialog){const r=dialog.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)dialog.close();}};if(onSubmit)$('form',dialog).addEventListener('submit',onSubmit);dialog.showModal();}
async function submitForm(form,url,data,onSuccess){const error=$('.form-error',form),message=$('.form-message',form),submit=$('button[type="submit"]',form);if(error)error.textContent='';if(message)message.textContent='';if(submit.disabled)return;const originalLabel=submit.innerHTML;submit.disabled=true;submit.textContent=url==='/api/login'?'Signing in…':'Saving…';try{const result=await api(url,data);if(message)message.textContent=result.message||'Saved successfully.';if(onSuccess)await onSuccess(result);else {form.reset();submit.hidden=true;}}catch(err){if(error)error.textContent=err.message;else toast(err.message);}finally{submit.disabled=false;submit.innerHTML=originalLabel;}}
function openSubmission(kind){
 const isMarket=kind==='sell',isReply=kind==='reply';let fields='';
 if(isMarket)fields=field('name','Item name')+field('category','Category','select',true,'',['Textbooks','Electronics','Furniture','Clothing','Accessories','School Supplies','Housing','Services','Other'])+field('price','Price (₦)','number')+field('contactPhone','Contact phone','tel')+field('contactWhatsApp','WhatsApp number','tel',false)+field('photo','Item photo','file',false)+field('description','Description','textarea');
 else fields=field('name','Your name')+field('email','Your email','email')+(!isReply?field('category','Category','select',true,'',categories)+field('title','Question title'):'')+field('content',isReply?'Your reply':'Your question','textarea')+'<label class="consent full"><input type="checkbox" name="anonymous"><span>Publish anonymously. Your email and real name are visible only to the moderation team.</span></label>';
 modal(isMarket?'Submit a marketplace listing':isReply?'Reply to this question':'Ask a study question',`<p class="content-note">${isMarket?'Your contact number will be public if this listing is approved. Only share contact details you have permission to publish.':'Share respectfully and avoid confidential or sensitive information.'} Submissions appear only after administrator review.</p><form><div class="form-grid">${fields}<p class="form-error full" role="alert"></p><p class="form-message full" role="status"></p><button class="button green-button full" type="submit">Submit for review <span>↗</span></button></div></form>`,async ev=>{ev.preventDefault();const form=ev.currentTarget,fd=new FormData(form),data=Object.fromEntries(fd);delete data.photo;data.anonymous=!!data.anonymous;try{if(isMarket)data.upload=await readUpload(fd.get('photo'));if(isReply)data.topicId=new URLSearchParams(location.search).get('id');await submitForm(form,isMarket?'/api/marketplace':isReply?'/api/replies':'/api/questions',data);}catch(err){$('.form-error',form).textContent=err.message;}});
}

// Administrator workspace: Firebase-authenticated requests to the shared backend.
const adminLabels={overview:'Overview',pending:'Moderation',leaders:'Executives',parliamentarians:'Parliamentarians',departments:'Our department',gallery:'Gallery',archive:'Archive',documents:'Documents','past-questions':'Study resources',marketplace:'Marketplace',topics:'Community questions',replies:'Community replies',advisors:'Advisors',faq:'FAQs',socials:'Social channels','department-socials':'Department channels',newsletter:'Newsletter editions',subscribers:'Subscribers',team:'Editorial team',faculty:'Association information',settings:'Contact settings'};
async function adminLogin(){
 let session;try{session=await api('/api/session');}catch(err){main.innerHTML=empty('SHARED BACKEND UNAVAILABLE.',err.message);return;}
 if(session.authenticated){await adminDashboard();return;}
 main.innerHTML=`<div class="auth-layout"><div class="auth-art"><p class="eyebrow yellow-text">THE EDITORIAL WORKSPACE</p><h1>NIMELSSA<br><span>admin</span></h1><p>Manage association information, resources and student submissions.</p><span class="auth-flower">✳</span></div><form class="form-panel" id="admin-login"><p class="eyebrow">AUTHORIZED ACCESS ONLY</p><h3>WELCOME BACK.</h3><p class="content-note">Sign in with an account granted NIMELSSA administrator access by the faculty portal administrator.</p><div class="form-grid">${field('email','Email address','email')}${field('password','Password','password')}<p class="form-error full" role="alert"></p><button type="submit" class="button green-button full">Sign in securely <span>↗</span></button></div><p class="fine-print">Need access? Contact your website administrator. No public account registration is available.</p></form></div>`;
 $('#admin-login').addEventListener('submit',async ev=>{ev.preventDefault();const f=ev.currentTarget;await submitForm(f,'/api/login',Object.fromEntries(new FormData(f)),async()=>{const verified=await api('/api/session');if(!verified.authenticated){saveSession('');throw Error('This Firebase account does not have NIMELSSA administrator access. Contact the faculty portal administrator.');}await adminDashboard();});});
}
async function adminDashboard(){
 try{const session=await api('/api/session');if(!session.authenticated){saveSession('');await adminLogin();return;}adminData=await loadAdminData();content=adminData.content;renderAdmin(session.email);}catch(err){main.innerHTML=empty('WORKSPACE UNAVAILABLE.',err.message,linkButton('Sign in', '/admin/login'));}
}
function recordTitle(r){return r.name||r.title||r.fileName||r.event||r.question||r.platform||r.id||'Untitled record';}
function adminRows(kind,rows){return rows.map(r=>`<div class="admin-row"><div><h3>${e(recordTitle(r))}</h3><p>${e(r.position||r.department||r.category||r.subject||r.description||'Published record')}</p></div><div class="row-actions"><button class="mini-button" data-edit-kind="${e(kind)}" data-record-id="${e(r.id)}">Edit</button><button class="mini-button danger" data-delete-kind="${e(kind)}" data-record-id="${e(r.id)}">Delete</button></div></div>`).join('');}
function renderAdmin(email){
 const count=Object.values(content).filter(Array.isArray).reduce((n,a)=>n+a.length,0),pending=adminData.submissions.filter(s=>s.status==='pending');
 main.innerHTML=`<div class="admin-top"><div><p class="eyebrow">NIMELSSA EDITORIAL WORKSPACE</p><h1>NIMELSSA admin</h1><p>Signed in as <strong>${e(email||'Administrator')}</strong></p></div><button data-action="logout">Sign out ↗</button></div><div class="admin-stat-grid"><div class="admin-stat"><b>${count}</b><span>PUBLISHED RECORDS</span></div><div class="admin-stat"><b>${pending.length}</b><span>AWAITING REVIEW</span></div><div class="admin-stat"><b>${adminData.subscribers.length}</b><span>NEWSLETTER SUBSCRIBERS</span></div><div class="admin-stat"><b>${(content.gallery||[]).length}</b><span>COMMUNITY PHOTOS</span></div></div><div class="admin-layout"><aside class="admin-sidebar" aria-label="Management sections">${Object.entries(adminLabels).map(([k,v])=>`<button class="admin-tab ${k===currentAdminTab?'active':''}" data-admin-tab="${k}">${e(v)}${k==='pending'&&pending.length?' ('+pending.length+')':''}</button>`).join('')}</aside><div id="admin-section"></div></div>`;renderAdminSection();
}
function renderAdminSection(){const el=$('#admin-section'),kind=currentAdminTab;$$('.admin-tab').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===kind));
 if(kind==='overview'){el.innerHTML=`<div class="faculty-aside"><p class="eyebrow">WELCOME TO YOUR WORKSPACE</p><h3>Update the NIMELSSA website</h3><p>Publish resources, update representatives, curate the gallery and review student submissions. NIMELSSA content is kept separate from the faculty portal while using its shared Firebase backend.</p></div><div class="content-note" style="margin-top:22px">Publish only approved NIMELSSA information, appointments, event photographs and contact channels. Newsletter subscriptions are stored, but email sending is not configured.</div><div class="section-title-row"><h2>Things to review</h2></div><div class="topic-list"><div class="topic-card"><h3>01 / Approved profiles</h3><p>Confirm that executive and parliamentarian profiles are current and approved.</p></div><div class="topic-card"><h3>02 / Association information</h3><p>Review the departmental introduction and add the approved NIMELSSA executive list and official contact details.</p></div><div class="topic-card"><h3>03 / Student submissions</h3><p>Review submissions before approving them. Add production hosting, backups, monitoring and email service before launch.</p></div></div>`;return;}
 if(kind==='pending'){const pending=adminData.submissions.filter(s=>s.status==='pending');el.innerHTML=`<div class="admin-heading"><h2>SUBMISSIONS FOR REVIEW</h2><span class="result-count">${pending.length} pending</span></div>${pending.length?'<div class="admin-list">'+pending.map(s=>`<div class="admin-row"><div><h3>${e(recordTitle(s.body))}</h3><p>${e(adminLabels[s.kind]||s.kind)} · ${e(dateString(s.created*1000))}</p></div><div class="row-actions"><button class="mini-button" data-review-id="${e(s.id)}">Review</button></div></div>`).join('')+'</div>':empty('No submissions to review.','There are no student submissions awaiting review.')}`;return;}
 if(kind==='team'){el.innerHTML=`<div class="admin-heading"><h2>EDITORIAL TEAM</h2>${button('Add administrator','add-admin')}</div><p class="content-note">Administrators have full access to content, moderation and subscriber information. Only add trusted editorial team members.</p><div class="admin-list">${(adminData.team||[]).map(r=>`<div class="admin-row"><div><h3>${e(r.email)}</h3><p>Administrator · Full workspace access</p></div><button class="mini-button danger" data-remove-admin="${e(r.email)}">Remove</button></div>`).join('')}</div>`;return;}
 if(kind==='subscribers'){el.innerHTML=`<div class="admin-heading"><h2>NEWSLETTER SUBSCRIBERS</h2>${button('Export CSV','export-subscribers')}</div><p class="content-note">Subscriber information is private. Use it only for the newsletter purpose students consented to. Automatic email sending is not connected.</p>${adminData.subscribers.length?'<div class="admin-list">'+adminData.subscribers.map(s=>`<div class="admin-row"><div><h3>${e(s.email)}</h3><p>${e(s.department)} · ${e(s.registration)}</p></div></div>`).join('')+'</div>':empty('No subscribers registered yet.','Students who register for newsletter updates will appear here.')}`;return;}
 if(['faculty','settings'].includes(kind)){el.innerHTML=`<div class="admin-heading"><h2>${e(adminLabels[kind].toUpperCase())}</h2>${button('Edit information','edit-object')}</div><div class="topic-card">${Object.entries(content[kind]||{}).filter(([k,v])=>typeof v==='string').map(([k,v])=>`<p class="eyebrow" style="margin-top:20px">${e(k)}</p><p class="prose">${e(v||'Not configured')}</p>`).join('')}</div>`;return;}
 const rows=content[kind]||[];el.innerHTML=`<div class="admin-heading"><h2>${e(adminLabels[kind].toUpperCase())}</h2>${button('Add new record','admin-new')}</div><div class="admin-list">${rows.length?adminRows(kind,rows):empty('No records published yet.','Add your first published record using the button above.')}</div>`;
}
const schemas={
 leaders:[['name','Full name'],['position','Position'],['department','Department'],['bio','Biography','textarea'],['photoUrl','Photo URL','url']],
 parliamentarians:[['name','Full name'],['position','Position'],['department','Department'],['order','Display order','number'],['bio','Biography','textarea'],['email','Public email','email'],['phone','Public phone','tel'],['image','Photo URL','url']],
 departments:[['name','Department name'],['description','Description','textarea']],
 gallery:[['event','Event name'],['description','Description','textarea'],['date','Date','date'],['photoUrl','Photo URL','url']],
 archive:[['title','Story title'],['description','Summary','textarea'],['content','Full story','textarea'],['date','Event date','date'],['image','Cover image URL','url']],
 documents:[['fileName','Document title'],['category','Category'],['description','Description','textarea'],['fileUrl','Resource URL','url']],
 'past-questions':[['fileName','Resource title'],['subject','Subject'],['semester','Level'],['description','Description','textarea'],['fileUrl','Resource URL','url']],
 marketplace:[['name','Item name'],['category','Category'],['price','Price (₦)','number'],['description','Description','textarea'],['contactPhone','Contact phone','tel'],['contactWhatsApp','WhatsApp','tel'],['image','Image URL','url']],
 topics:[['title','Question title'],['name','Public display name'],['category','Category'],['content','Question','textarea']],
 replies:[['topicId','Topic ID'],['name','Public display name'],['content','Reply','textarea']],
 advisors:[['name','Full name'],['role','Role'],['specialty','Specialty'],['bio','Biography','textarea'],['image','Image URL','url']],
 faq:[['question','Question'],['answer','Answer','textarea']],
 socials:[['name','Channel name'],['platform','Platform'],['handle','Handle'],['url','Channel URL','url']],
 'department-socials':[['name','Channel name'],['department','Department'],['platform','Platform'],['url','Channel URL','url']],
 newsletter:[['title','Edition title'],['date','Publish date','date'],['content','Edition content','textarea']],
 faculty:[['name','Site name'],['content','Introduction','textarea'],['mission','Mission','textarea'],['vision','Vision','textarea'],['historyLabel','History section title'],['historyNote','Historical context note','textarea'],['history','Historical record','textarea']],
 settings:[['brand','Brand name'],['location','Location'],['email','Official email','email'],['phone','Official phone','tel']]
};
function editRecord(kind,id){
 const original=['faculty','settings'].includes(kind)?(content[kind]||{}):(content[kind]||[]).find(r=>r.id===id)||{};const schema=schemas[kind]||[];
 let fields=schema.map(([key,label,type='text'],i)=>{let value=original[key]??'';if(type==='date'&&value){const stamp=typeof value==='object'?value._seconds*1000:value;const d=new Date(stamp);value=Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);}return field(key,label,type==='url'?'text':type,i===0,value);}).join('');
 const supportsUpload=['leaders','parliamentarians','gallery','archive','marketplace','advisors','documents','past-questions'].includes(kind);
 if(supportsUpload)fields+=`<label class="field full"><span>${['documents','past-questions'].includes(kind)?'Upload file (PDF or image)':'Upload photo'}. optional, 8 MB maximum</span><input type="file" name="upload-file" accept="${['documents','past-questions'].includes(kind)?'application/pdf,':''}image/jpeg,image/png,image/webp"><small>A local upload replaces the URL field. Existing URLs may be left unchanged.</small></label>`;
 modal((id?'EDIT ':'ADD ')+(adminLabels[kind]||kind).toUpperCase(),`<form class="admin-form"><div class="form-grid">${fields}<p class="form-error full" role="alert"></p><button type="submit" class="button green-button full">Save & publish <span>↗</span></button></div></form>`,async ev=>{ev.preventDefault();const f=ev.currentTarget,fd=new FormData(f),record={...original};for(const [k,,type] of schema)record[k]=type==='number'&&fd.get(k)!==''?Number(fd.get(k)):String(fd.get(k)||'');try{const upload=await readUpload(fd.get('upload-file'));if(upload){record.upload=upload;delete record.photoUrl;}await submitForm(f,'/api/admin/save',{kind,record},async()=>{$('#site-dialog').close();toast('Published successfully.');await refreshAdmin();});}catch(err){$('.form-error',f).textContent=err.message;}});
}
async function loadAdminData(){
 let data=await api('/api/admin/content');
 if(!data.initialized){
  const response=await fetch('/data/seed.json');
  if(!response.ok)throw Error('Unable to load the NIMELSSA starter content needed to initialize the shared backend.');
  await api('/api/admin/initialize',{seed:await response.json()});
  data=await api('/api/admin/content');
 }
 return data;
}
async function refreshAdmin(){adminData=await loadAdminData();content=adminData.content;const session=await api('/api/session');renderAdmin(session.email);}
function reviewSubmission(id){const s=adminData.submissions.find(v=>v.id===id);if(!s)return;modal('REVIEW SUBMISSION',`<span class="tag">${e(adminLabels[s.kind]||s.kind)}</span><div class="pending-body">${Object.entries(s.body).filter(([k])=>!['id','upload'].includes(k)).map(([k,v])=>`<strong>${e(k)}</strong>: ${e(v)}`).join('\n\n')}</div>${s.body.image?image(s.body.image,s.body.name,'detail-image'):''}<div class="detail-actions"><button class="button green-button" data-moderate-id="${e(id)}" data-decision="approve">Approve & publish ↗</button><button class="button white" data-moderate-id="${e(id)}" data-decision="reject">Reject submission</button></div>`);}
function exportSubscribers(){const rows=[['Email','Registration','Department','Consent','Created'],...adminData.subscribers.map(s=>[s.email,s.registration,s.department,String(s.consent),s.createdAt])];const csv=rows.map(r=>r.map(v=>{v=String(v??'');if(/^[=+@\-]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='nimelssa-newsletter-subscribers.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.addEventListener('click',async ev=>{
 const action=ev.target.closest('[data-action]')?.dataset.action;
 if(action==='more-gallery'){galleryLimit+=24;renderResults();}
 if(['sell','question','reply'].includes(action))openSubmission(action);
 if(action==='logout'){try{await api('/api/logout',{});}finally{saveSession('');await adminLogin();}}
 if(action==='admin-new')editRecord(currentAdminTab);
 if(action==='edit-object')editRecord(currentAdminTab,'object');
 if(action==='export-subscribers')exportSubscribers();
 if(action==='add-admin')modal('ADD AN ADMINISTRATOR.',`<p class="content-note">An existing Firebase account can be granted NIMELSSA access. If the email is new to Firebase, provide a strong initial password.</p><form><div class="form-grid">${field('email','Administrator email','email')}${field('password','Initial password for a new account (12+ characters)','password',false)}<p class="form-error full" role="alert"></p><button type="submit" class="button green-button full">Grant NIMELSSA access ↗</button></div></form>`,async event=>{event.preventDefault();await submitForm(event.currentTarget,'/api/admin/team',Object.fromEntries(new FormData(event.currentTarget)),async()=>{$('#site-dialog').close();toast('NIMELSSA administrator access granted.');await refreshAdmin();});});
 const removeAdmin=ev.target.closest('[data-remove-admin]');if(removeAdmin){const email=removeAdmin.dataset.removeAdmin;modal('REMOVE ADMINISTRATOR?',`<p class="muted">Remove workspace access for ${e(email)}? You cannot remove your own account.</p><button class="button green-button" data-confirm-remove-admin="${e(email)}">Remove access</button>`);}
 const confirmAdmin=ev.target.closest('[data-confirm-remove-admin]');if(confirmAdmin){try{await api('/api/admin/team',{action:'delete',email:confirmAdmin.dataset.confirmRemoveAdmin});$('#site-dialog').close();toast('Administrator removed.');await refreshAdmin();}catch(err){toast(err.message);}}
 const chip=ev.target.closest('[data-companion-category]');if(chip){const active=chip.classList.contains('active');$$('[data-companion-category]').forEach(b=>b.classList.remove('active'));if(!active)chip.classList.add('active');const rows=(content.topics||[]).filter(r=>active||r.category===chip.dataset.companionCategory);$('#topic-results').innerHTML=topicCards(rows);}
 const tab=ev.target.closest('[data-admin-tab]');if(tab){currentAdminTab=tab.dataset.adminTab;renderAdminSection();}
 const edit=ev.target.closest('[data-edit-kind]');if(edit)editRecord(edit.dataset.editKind,edit.dataset.recordId);
 const del=ev.target.closest('[data-delete-kind]');if(del){const {deleteKind:kind,recordId:id}=del.dataset;modal('REMOVE THIS RECORD?',`<p class="muted">This removes the record from the public website. This action cannot be undone.</p><div class="detail-actions"><button class="button green-button" data-confirm-delete-kind="${e(kind)}" data-record-id="${e(id)}">Yes, remove record</button></div>`);}
 const confirmed=ev.target.closest('[data-confirm-delete-kind]');if(confirmed){try{await api('/api/admin/delete',{kind:confirmed.dataset.confirmDeleteKind,id:confirmed.dataset.recordId});$('#site-dialog').close();toast('Record removed.');await refreshAdmin();}catch(err){toast(err.message);}}
 const review=ev.target.closest('[data-review-id]');if(review)reviewSubmission(review.dataset.reviewId);
 const mod=ev.target.closest('[data-moderate-id]');if(mod){mod.disabled=true;try{await api('/api/admin/moderate',{id:mod.dataset.moderateId,action:mod.dataset.decision});$('#site-dialog').close();toast('Submission '+(mod.dataset.decision==='approve'?'published.':'rejected.'));await refreshAdmin();}catch(err){toast(err.message);mod.disabled=false;}}
});
async function start(){
 if(!page)return;
 if(page==='admin-login')return adminLogin();if(page==='admin-dashboard')return adminDashboard();
 try{await loadContent();if(page==='departments')departmentPage();else if(['leaders','parliamentarians','gallery','archive','documents','past-questions','marketplace'].includes(page))listingPage();else if(page.endsWith('-detail'))detailPage();else if(page==='faculty')facultyPage();else if(page==='newsletter-login')newsletterPage();else if(page==='companion')companionPage();else if(page==='social-handles')socialsPage();else if(page==='newsletter')newslettersPage();}
 catch(err){main.innerHTML=empty('WE’LL BE RIGHT BACK.',err.message,linkButton('Back to home','/'));}
}
start();
})();
