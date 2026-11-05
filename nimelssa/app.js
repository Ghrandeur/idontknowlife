const ORIGINAL_SITE = '';
// All navigation stays inside this application.
function connectLinks(root = document) { root.querySelectorAll('[data-page]').forEach(link => { link.href = `${ORIGINAL_SITE}/pages/${link.dataset.page}`; }); }
connectLinks();
const icons = {
 paper:'<path d="M9 3H5v26h22V9l-6-6H9Z"/><path d="M21 3v7h6M10 16h12M10 21h12M10 26h7"/>',
 book:'<path d="M16 9C11 5 6 5 2 7v21c5-2 9-2 14 2 5-4 9-4 14-2V7c-4-2-9-2-14 2Z"/><path d="M16 9v21M6 12h5M6 17h5M21 12h5M21 17h5"/>',
 companion:'<path d="M5 19v-4a11 11 0 0 1 22 0v4M5 16H2v9h6v-9H5ZM27 16h3v9h-6v-9h3ZM26 25v3h-9"/><circle cx="15" cy="28" r="2"/>',
 shop:'<path d="M4 13v16h24V13M2 12l4-9h20l4 9M2 12c0 6 7 6 7 0 0 6 7 6 7 0 0 6 7 6 7 0 0 6 7 6 7 0M12 29V19h8v10M10 3l-1 9M22 3l1 9"/>',
 archive:'<path d="M4 11h24v18H4zM2 4h28v7H2zM12 17h8"/>',
 image:'<rect x="3" y="3" width="26" height="26" rx="3"/><circle cx="11" cy="11" r="3"/><path d="m3 25 9-8 6 5 5-7 6 7"/>',
 mail:'<rect x="2" y="6" width="28" height="22" rx="3"/><path d="m3 8 13 10L29 8M3 26l9-9M29 26l-9-9"/>',
 share:'<circle cx="24" cy="6" r="4"/><circle cx="7" cy="16" r="4"/><circle cx="24" cy="26" r="4"/><path d="m10 14 10-6M10 18l10 6"/>'
};
const resources = [
 {title:'Past questions',description:'Search by subject and level',page:'past-questions',icon:'book'},
 {title:'Study questions',description:'Ask the student community',page:'companion',icon:'companion',featured:true},
 {title:'Department documents',description:'Find published departmental files',page:'documents',icon:'paper'},
 {title:'Student marketplace',description:'Browse or submit a student listing',page:'marketplace',icon:'shop'},
 {title:'Association updates',description:'Register for NIMELSSA announcements',page:'newsletter-login',icon:'mail'},
 {title:'News and past events',description:'Read published announcements',page:'archive',icon:'archive'},
 {title:'Event photos',description:'See approved department photographs',page:'gallery',icon:'image'},
 {title:'Contact and channels',description:'Find official contact details',page:'social-handles',icon:'share'}
];
const resourceGrid = document.getElementById('resource-grid');
function renderResources(query='') {
 const filtered=resources.filter(item => `${item.title} ${item.description}`.toLowerCase().includes(query.toLowerCase().trim()));
 resourceGrid.innerHTML = filtered.map(item => `<a class="resource-card${item.featured?' featured':''}" href="${ORIGINAL_SITE}/pages/${item.page}"><span class="resource-icon"><svg viewBox="0 0 32 32" aria-hidden="true">${icons[item.icon]}</svg></span><h3>${item.title}</h3><div><p>${item.description}</p><span class="arrow" aria-hidden="true">↗</span></div></a>`).join('');
 document.querySelector('.empty-search').hidden=filtered.length>0;
}
renderResources();
document.getElementById('resource-search').addEventListener('input', e=>renderResources(e.target.value));
const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
const currentDate=new Date();
let viewYear=currentDate.getFullYear(),viewMonth=currentDate.getMonth(),selectedDate=new Date(viewYear,viewMonth,currentDate.getDate());
function renderCalendar(){
 document.getElementById('calendar-year').textContent=viewYear;
 document.getElementById('month-title').textContent=`${monthNames[viewMonth]} ${viewYear}`;
 document.getElementById('months').innerHTML=monthNames.map((name,i)=>`<button type="button" data-month="${i}" class="${i===viewMonth?'selected':''}" aria-pressed="${i===viewMonth}">${name}</button>`).join('');
 const firstDay=(new Date(viewYear,viewMonth,1).getDay()+6)%7;
 const daysInMonth=new Date(viewYear,viewMonth+1,0).getDate();
 const prevMonthDays=new Date(viewYear,viewMonth,0).getDate();
 let html='';
 for(let i=firstDay;i>0;i--)html+=`<span aria-hidden="true">${prevMonthDays-i+1}</span>`;
 for(let day=1;day<=daysInMonth;day++){
  const isToday=day===currentDate.getDate()&&viewMonth===currentDate.getMonth()&&viewYear===currentDate.getFullYear();
  const chosen=selectedDate&&day===selectedDate.getDate()&&viewMonth===selectedDate.getMonth()&&viewYear===selectedDate.getFullYear();
  html+=`<button type="button" data-day="${day}" class="${isToday?'today ':''}${chosen?'chosen':''}" aria-label="${day} ${monthNames[viewMonth]} ${viewYear}" aria-pressed="${!!chosen}"${isToday?' aria-current="date"':''}>${day}</button>`;
 }
 const remaining=(7-(firstDay+daysInMonth)%7)%7;
 for(let i=1;i<=remaining;i++)html+=`<span aria-hidden="true">${i}</span>`;
 document.getElementById('calendar-days').innerHTML=html;
 if(selectedDate&&selectedDate.getMonth()===viewMonth&&selectedDate.getFullYear()===viewYear) document.getElementById('selected-date').textContent=`${selectedDate.getDate()} ${monthNames[viewMonth]}. No events published.`;
 else document.getElementById('selected-date').textContent='Select a date · official dates to be announced';
}
document.getElementById('months').addEventListener('click',e=>{const b=e.target.closest('[data-month]');if(b){viewMonth=Number(b.dataset.month);renderCalendar();}});
document.getElementById('calendar-days').addEventListener('click',e=>{const b=e.target.closest('[data-day]');if(b){selectedDate=new Date(viewYear,viewMonth,Number(b.dataset.day));renderCalendar();}});
document.getElementById('prev-year').addEventListener('click',()=>{viewYear--;renderCalendar();});
document.getElementById('next-year').addEventListener('click',()=>{viewYear++;renderCalendar();});
document.getElementById('today-button').addEventListener('click',()=>{viewYear=currentDate.getFullYear();viewMonth=currentDate.getMonth();selectedDate=new Date(viewYear,viewMonth,currentDate.getDate());renderCalendar();});
renderCalendar();
const slides=[
 {copy:'If you cannot find a course material, check the subject and level filters in the study library. You can also post a question for the student community.',link:'companion',label:'Ask a question'},
 {copy:'The executive page is where the association will publish its approved list of representatives. If a name or contact is missing, it has not been confirmed for this site yet.',link:'leaders',label:'View executive information'},
 {copy:'Selling a textbook or another student item? Submit a listing with a clear description and a contact number you are comfortable sharing. Listings are reviewed before they appear.',link:'marketplace',label:'Open the marketplace'}
];
let slideIndex=0;
function showSlide(){const slide=slides[slideIndex];document.getElementById('spotlight-copy').textContent=slide.copy;document.getElementById('spotlight-link').innerHTML=`${slide.label} <span>↗</span>`;document.getElementById('spotlight-link').href=`${ORIGINAL_SITE}/pages/${slide.link}`;document.getElementById('slide-count').textContent=`0${slideIndex+1} / 03`;}
document.getElementById('slide-prev').addEventListener('click',()=>{slideIndex=(slideIndex+slides.length-1)%slides.length;showSlide();});
document.getElementById('slide-next').addEventListener('click',()=>{slideIndex=(slideIndex+1)%slides.length;showSlide();});
document.getElementById('copyright-year').textContent=currentDate.getFullYear();
