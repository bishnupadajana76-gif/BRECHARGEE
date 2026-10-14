const $ = (id) => document.getElementById(id);
let token = "";
let currentUser = null;
const money = (v) => "₹" + Number(v || 0).toLocaleString("en-IN", {minimumFractionDigits:2, maximumFractionDigits:2});
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notify(message, bad=false) {
  const el = $("notice"); el.textContent = message; el.classList.remove("hidden","bad");
  if (bad) el.classList.add("bad");
  window.scrollTo({top:0,behavior:"smooth"});
}
async function api(url, options={}) {
  const res = await fetch(url, {...options, headers: {
    "Content-Type":"application/json",
    ...(token ? {Authorization:"Bearer "+token} : {}),
    ...(options.headers || {})
  }});
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
function showApp(user) {
  currentUser = user; $("login-screen").classList.add("hidden"); $("app").classList.remove("hidden");
  $("admin-name").textContent = user.name; $("welcome-name").textContent = user.name;
  loadDashboard();
}
$("login-form").addEventListener("submit", async e => {
  e.preventDefault(); $("login-error").textContent = "";
  try {
    const result = await api("/api/auth/login", {method:"POST", body:JSON.stringify({email:$("email").value,password:$("password").value})});
    if (result.user.role !== "admin") throw new Error("এই account-টি admin নয়");
    token = result.token;
    // Token stays in memory only; refresh করলে আবার login করতে হবে.
    showApp(result.user);
  } catch (err) { $("login-error").textContent = err.message; }
});
$("logout").addEventListener("click", () => { token=""; currentUser=null; $("app").classList.add("hidden"); $("login-screen").classList.remove("hidden"); $("password").value=""; });
document.querySelectorAll(".nav").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".nav").forEach(n=>n.classList.remove("active")); btn.classList.add("active");
  document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
  const page = btn.dataset.page; $(page+"-page").classList.remove("hidden");
  $("page-title").textContent = ({dashboard:"Dashboard",users:"Retailer / Distributor",recharges:"Recharge History",commissions:"Commission Rules"})[page];
  if(page==="users") loadUsers(); if(page==="recharges") loadRecharges(); if(page==="commissions") loadCommissions();
}));
async function loadDashboard() {
  try {
    const d=await api("/api/admin/summary");
    $("stat-users").textContent=d.users.filter(u=>u.role!=="admin").reduce((n,u)=>n+u.count,0);
    $("stat-recharges").textContent=d.rechargeCount; $("stat-volume").textContent=money(d.rechargeVolume);
    $("stat-pending").textContent=d.pendingRecharges; $("stat-wallet").textContent=money(d.walletBalanceTotal);
    $("stat-commissions").textContent=d.activeCommissionRules;
  } catch(e) { notify(e.message,true); }
}
async function loadUsers() {
  try {
    const rows=await api("/api/admin/users");
    $("users-table").innerHTML=rows.map(u=>`<tr><td>${u.id}</td><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td><span class="pill">${esc(u.role)}</span></td><td><span class="pill ${esc(u.status)}">${esc(u.status)}</span></td><td>${money(u.wallet_balance)}</td></tr>`).join("") || '<tr><td colspan="6">এখনও কোনো account নেই।</td></tr>';
  } catch(e){notify(e.message,true);}
}
$("user-form").addEventListener("submit", async e=>{
  e.preventDefault(); const form=new FormData(e.target); const body=Object.fromEntries(form.entries());
  try { await api("/api/admin/users",{method:"POST",body:JSON.stringify(body)}); e.target.reset(); notify("Account সফলভাবে তৈরি হয়েছে।"); loadUsers(); loadDashboard(); }
  catch(err){notify(err.message,true);}
});
async function loadRecharges(){
  try {
    const rows=await api("/api/admin/recharges");
    $("recharges-table").innerHTML=rows.map(r=>`<tr><td>${r.id}</td><td>${esc(r.user_name)}</td><td>${esc(r.mobile_number)}</td><td>${esc(r.operator)}</td><td>${money(r.amount)}</td><td><span class="pill ${esc(r.status)}">${esc(r.status)}</span></td><td>${new Date(r.created_at).toLocaleString()}</td></tr>`).join("") || '<tr><td colspan="7">এখনও recharge record নেই।</td></tr>';
  }catch(e){notify(e.message,true);}
}
async function loadCommissions(){
  try {
    const rows=await api("/api/admin/commissions");
    $("commissions-table").innerHTML=rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${esc(r.operator)}</td><td>${esc(r.service_type)}</td><td>${esc(r.role)}</td><td>${Number(r.percent).toFixed(4)}%</td><td>${money(r.flat_amount)}</td><td><span class="pill ${r.active?'active':'blocked'}">${r.active?'Active':'Inactive'}</span></td></tr>`).join("") || '<tr><td colspan="7">কোনো commission rule নেই।</td></tr>';
  }catch(e){notify(e.message,true);}
}
$("commission-form").addEventListener("submit",async e=>{
  e.preventDefault(); const body=Object.fromEntries(new FormData(e.target).entries());
  try { await api("/api/admin/commissions",{method:"POST",body:JSON.stringify(body)}); notify("Commission rule save হয়েছে।"); e.target.reset(); loadCommissions(); loadDashboard(); }
  catch(err){notify(err.message,true);}
});
$("refresh-users").addEventListener("click",loadUsers);
$("refresh-recharges").addEventListener("click",loadRecharges);
$("refresh-commissions").addEventListener("click",loadCommissions);
