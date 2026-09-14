const API_URL='https://script.google.com/macros/s/AKfycbxZMShPOB21woyPAtHeQbZNCYZm1lARPX9IVy7qzX3sGpdbqHjPglO7J_wa6wtuWFlK/exec';
let globalData={};
let allSheetNames=[];
let activeSheetName='';
let currentSortCol='total';
let sortAscending=false;
let focusedDateCol=null;
let fetchPromises={};
let profileRequestToken=0;

function renderSkeleton(isFirstLoad=true){
if(isFirstLoad){
document.getElementById('controlsArea').innerHTML=`
          <div class="sk-box" style="height: 28px; width: 120px; margin: 0;"></div>
          <div class="sk-box" style="height: 36px; width: 80px; border-radius: 18px; margin: 0;"></div>
        `;
}

const emptyTh=Array(9).fill('<th><div class="sk-box" style="height: 16px; margin: 0 auto; width: 60%;"></div></th>').join('');
const emptyTd=Array(9).fill('<td><div class="sk-box" style="height: 16px; margin: 0 auto; width: 50%;"></div></td>').join('');
const emptyRows=Array(8).fill(`<tr>
        <td><div class="sk-box" style="height: 26px; width: 26px; border-radius: 50%; margin: 0 auto;"></div></td>
        <td><div class="sk-box" style="height: 16px; margin: 0; width: 90%;"></div></td>
        <td><div class="sk-box" style="height: 16px; margin: 0 auto; width: 50%;"></div></td>
        ${emptyTd}
      </tr>`).join('');

document.getElementById('contentArea').innerHTML=`
        <div class="table-container">
          <table>
            <thead id="tableHead"><tr>
              <th><div class="sk-box" style="height: 16px; margin: 0 auto; width: 60%;"></div></th>
              <th><div class="sk-box" style="height: 16px; margin: 0; width: 80%;"></div></th>
              <th><div class="sk-box" style="height: 16px; margin: 0 auto; width: 60%;"></div></th>
              ${emptyTh}
            </tr></thead>
            <tbody>${emptyRows}</tbody>
          </table>
        </div>`;
}

async function fetchData(){
renderSkeleton(true);
try{
const res=await(await fetch(API_URL)).json();
if(!res.sheetNames?.length)throw new Error('未獲取到資料');

allSheetNames=res.sheetNames;
activeSheetName=res.firstSheetName;
globalData[activeSheetName]=res.firstSheetData;

renderControls();
renderTableLayout();
preloadRemainingSheets();
}catch(err){
document.getElementById('controlsArea').innerHTML='';
document.getElementById('contentArea').innerHTML=`
          <div class="error-container">
            <div>載入失敗 (${err.message})，請檢查網絡連線或稍後再試。</div>
            <button class="retry-btn" onclick="fetchData()">重新載入</button>
          </div>`;
}
}

async function preloadRemainingSheets(){
await Promise.all(allSheetNames.map(sheet=>{
if(globalData[sheet]||fetchPromises[sheet])return Promise.resolve();
fetchPromises[sheet]=fetch(`${API_URL}?sheet=${encodeURIComponent(sheet)}`)
.then(res=>res.json())
.then(data=>globalData[sheet]=data)
.catch(()=>delete fetchPromises[sheet]);
return fetchPromises[sheet];
}));
}

function renderControls(){
const isOverall=activeSheetName==='總排名';
const menuHtml=allSheetNames.filter(n=>n!=='總排名').map(m=>`
        <div class="custom-dropdown-item ${m === activeSheetName ? 'selected' : ''}" data-value="${m}">
          <span>${m}</span>${m === activeSheetName ? '<span style="font-size:14px; font-weight:bold;">✓</span>' : ''}
        </div>`).join('');

document.getElementById('controlsArea').innerHTML=`
        <div class="custom-dropdown-container" id="dropdownContainer">
          <button id="monthSelectorTrigger" class="month-dropdown">${activeSheetName}</button>
          <div id="monthSelectorMenu" class="custom-dropdown-menu">${menuHtml}</div>
        </div>
        <button id="overallBtn" class="overall-btn ${isOverall ? 'active' : ''}">總排名</button>
      `;

const menu=document.getElementById('monthSelectorMenu');
document.getElementById('monthSelectorTrigger').addEventListener('click',e=>{
menu.classList.toggle('show');
e.stopPropagation();
});

menu.querySelectorAll('.custom-dropdown-item').forEach(item=>{
item.addEventListener('click',async e=>{
menu.classList.remove('show');
const val=e.currentTarget.getAttribute('data-value');
if(activeSheetName!==val)await switchSheet(val);
});
});

document.getElementById('overallBtn').addEventListener('click',async()=>{
if(activeSheetName!=='總排名')await switchSheet('總排名');
});
}

async function switchSheet(sheetName){
activeSheetName=sheetName;
currentSortCol='total';
sortAscending=false;
focusedDateCol=null;
renderControls();

if(!globalData[sheetName])await fetchSingleSheetData(sheetName);
else renderTableLayout();
}

async function fetchSingleSheetData(sheetName){
renderSkeleton(false);
try{
if(!fetchPromises[sheetName]){
fetchPromises[sheetName]=fetch(`${API_URL}?sheet=${encodeURIComponent(sheetName)}`).then(res=>res.json());
}
globalData[sheetName]=await fetchPromises[sheetName];
if(activeSheetName===sheetName)renderTableLayout();
}catch(err){
delete fetchPromises[sheetName];
if(activeSheetName===sheetName){
document.getElementById('contentArea').innerHTML=`
            <div class="error-container">
              <div>分頁【${sheetName}】資料載入失敗 (${err.message})</div>
              <button class="retry-btn" onclick="fetchSingleSheetData('${sheetName}')">重試</button>
            </div>`;
}
}
}

window.handleSort=function(colIndex){
const prevFocused=focusedDateCol;
sortAscending=currentSortCol===colIndex?!sortAscending:false;
currentSortCol=colIndex;
focusedDateCol=colIndex==='total'?null:colIndex;
(prevFocused!==focusedDateCol||focusedDateCol!==null)?renderTableLayout():(updateHeaderIcons(),renderTableBody());
};

const getSortIcon=(col)=>currentSortCol===col?(sortAscending?'<span class="sort-icon">▲</span>':'<span class="sort-icon">▼</span>'):'';

function updateHeaderIcons(){
document.querySelectorAll('#tableHead th[data-col]').forEach(th=>{
const col=th.dataset.col;
const icon=th.querySelector('.sort-icon-container');
if(icon)icon.innerHTML=getSortIcon(col==='total'?'total':parseInt(col,10));
});
}

function getColLimit(data,isOverall){
if(isOverall&&data[1]){
const limitIndex=data[1].findIndex((v,i)=>i>=2&&(!v||String(v).includes('Rank')));
return limitIndex!==-1?limitIndex:data[1].length;
}
return 17;
}

function getValidColumnsOrder(data,colLimit,focusedCol,isOverall){
let cols=Array.from({length:colLimit-2},(_,i)=>i+2).filter(c=>c!==focusedCol);
if(!isOverall){
cols.sort((a,b)=>{
const vA=data[1][a],vB=data[1][b];
const hasA=vA!==""&&vA!==undefined,hasB=vB!==""&&vB!==undefined;
if(hasA&&!hasB)return-1;
if(!hasA&&hasB)return 1;
if(hasA&&hasB&&!isNaN(Number(vA))&&!isNaN(Number(vB)))return Number(vB)-Number(vA);
return 0;
});
}
return focusedCol!==null?[focusedCol,...cols]:cols;
}

function formatHeaderDate(dayVal,data,sheetName){
if(isNaN(Number(dayVal)))return dayVal;

let monthStr=String(data[0]?.[0]??'').trim();

if(!monthStr||isNaN(Number(monthStr))){
monthStr=String(new Date().getMonth()+1);
}

return`${dayVal}/${monthStr}`;
}

function renderTableLayout(){
const data=globalData[activeSheetName];
const isOverall=activeSheetName==='總排名';
const colIndices=getValidColumnsOrder(data,getColLimit(data,isOverall),focusedDateCol,isOverall);

let headHtml=colIndices.map(j=>{
const val=data[1][j];
const isF=j===focusedDateCol;
const text=val!==""&&val!==undefined?(isOverall?val:formatHeaderDate(val,data,activeSheetName)):'-';
const icon=val!==""&&val!==undefined?`<span class="sort-icon-container">${getSortIcon(j)}</span>`:'';
return`<th data-col="${j}" class="${isF ? 'focused-sticky' : ''}">${text} ${icon}</th>`;
}).join('');

document.getElementById('contentArea').innerHTML=`
        <div class="table-container">
          <table>
            <thead id="tableHead"><tr>
              <th>Rank</th><th>Name</th>
              <th data-col="total" class="${focusedDateCol ? 'total-no-shadow' : ''}">Total <span class="sort-icon-container">${getSortIcon('total')}</span></th>
              ${headHtml}
            </tr></thead>
            <tbody id="tableBody"></tbody>
          </table>
        </div>`;

renderTableBody();
document.querySelectorAll('#tableHead th[data-col]').forEach(th=>{
th.addEventListener('click',()=>handleSort(th.dataset.col==='total'?'total':parseInt(th.dataset.col,10)));
});
}

function renderTableBody(){
const tbody=document.getElementById('tableBody');
if(!tbody)return;

const data=globalData[activeSheetName];
const isOverall=activeSheetName==='總排名';
const colLimit=getColLimit(data,isOverall);
const colIndices=getValidColumnsOrder(data,colLimit,focusedDateCol,isOverall);

let rows=data.slice(2).filter(r=>r[0]).map(row=>{
const hasPart=row.slice(2,colLimit).some(v=>v!==""&&v!==undefined&&v!=="-"&&String(v).trim()!=="");
return{data:row,total:Number(row[1])||0,hasPart};
}).sort((a,b)=>b.hasPart-a.hasPart||b.total-a.total);

let rank=1,displayRank=1,prev=null;
rows.forEach(r=>{
if(!r.hasPart){r.rank='-';return;}
if(r.total!==prev){displayRank=rank;prev=r.total;}
r.rank=displayRank;rank++;
});

rows.sort((a,b)=>{
if(!a.hasPart||!b.hasPart)return b.hasPart-a.hasPart;
let vA=currentSortCol==='total'?a.total:(Number(a.data[currentSortCol])||-Infinity);
let vB=currentSortCol==='total'?b.total:(Number(b.data[currentSortCol])||-Infinity);
return sortAscending?vA-vB:vB-vA;
});

tbody.innerHTML=rows.map(r=>{
const rHtml=!r.hasPart?`<span class="rank-other">-</span>`:(r.rank<=3?`<span class="rank-circle rank-${r.rank}">${r.rank}</span>`:`<span class="rank-other">${r.rank}</span>`);
const tClass=r.total>0?'win':(r.total<0?'lose':'');

let colsHtml=colIndices.map(j=>{
const v=r.data[j];
const hasV=v!==""&&v!==undefined;
const cClass=hasV&&v>0?'win':(hasV&&v<0?'lose':'');
return`<td class="${cClass} ${j === focusedDateCol ? 'focused-sticky' : ''}">${hasV ? v : '-'}</td>`;
}).join('');

const playerName=String(r.data[0]??'').replace(/"/g, '&quot;');
        const safeName = playerName.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const nameHtml = `<button type="button" class="player-name-btn" data-player="${playerName}">${safeName}</button>`;

        return `<tr><td>${rHtml}</td><td>${nameHtml}</td><td class="${tClass}${focusedDateCol?'total-no-shadow':''}">${r.total}</td>${colsHtml}</tr>`;
      }).join('');

      tbody.querySelectorAll('.player-name-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          openPlayerProfile(btn.dataset.player);
        });
      });
    }

    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g,'&quot;')
.replace(/'/g, '&#039;');
    }

    function scoreNumber(v) {
      if (v === null || v === undefined) return null;
      const text = String(v).trim();
      if (text === '' || text === '-' || text === '—') return null;
      const n = Number(text);
      return Number.isFinite(n) ? n : null;
    }

    function inferMonthNumber(sheetName, data) {
      if (sheetName === '總排名' || !Array.isArray(data) || !data[0]) return 0;

      const monthStr = String(data[0][0] ?? '').trim();
      const monthNum = Number(monthStr);

      if (Number.isFinite(monthNum) && monthNum >= 1 && monthNum <= 12) {
        return monthNum;
      }

      return 0;
    }

    function getSheetGameColumns(sheetName, data) {
      if (!Array.isArray(data) || data.length < 2 || sheetName === '總排名') return [];
      const limit = getColLimit(data, false);
      const result = [];
      for (let j = 2; j < limit; j++) {
        const header = data[1]?.[j];
        if (header !== '' && header !== undefined && header !== null) result.push(j);
      }
      return result;
    }

    function findPlayerRow(data, playerName) {
      if (!Array.isArray(data)) return null;
      return data.slice(2).find(r => String(r?.[0] ?? '') === String(playerName)) || null;
    }

    function addOutcome(record, score) {
      record.games++;
      record.total += score;
      record.scores.push(score);
      if (score > 0) record.wins++;
      else if (score < 0) record.losses++;
      else record.draws++;
    }

    function collectPlayerStats(playerName, sheets) {
      const stats = {
        name: playerName,
        month: { games: 0, wins: 0, losses: 0, draws: 0, total: 0, scores: [], sheetName: '' },
        year: { games: 0, wins: 0, losses: 0, draws: 0, total: 0, scores: [] },
        recent: [],
        opponents: {}
      };

      const sortedSheets = sheets
        .filter(s => Array.isArray(s.data))
        .map(s => ({ ...s, monthNo: inferMonthNumber(s.name, s.data) }))
        .sort((a, b) => a.monthNo - b.monthNo);

      let profileMonthName = activeSheetName;
      if (profileMonthName === '總排名') {
        const latest = sortedSheets[sortedSheets.length - 1];
        profileMonthName = latest ? latest.name : '';
      }
      stats.month.sheetName = profileMonthName;

      sortedSheets.forEach(sheet => {
        const row = findPlayerRow(sheet.data, playerName);
        if (!row) return;

        const cols = getSheetGameColumns(sheet.name, sheet.data);

        cols.forEach(j => {
          const target = scoreNumber(row[j]);
          if (target === null) return;

          const dateLabel = formatHeaderDate(sheet.data[1]?.[j], sheet.data, sheet.name);
          const game = { score: target, sheet: sheet.name, monthNo: sheet.monthNo, date: dateLabel, col: j };

          addOutcome(stats.year, target);
          stats.recent.push(game);

          if (sheet.name === profileMonthName) {
            addOutcome(stats.month, target);
          }

        sheet.data.slice(2).forEach(opRow => {
          const opponent = String(opRow?.[0] ?? '');

          if (!opponent || opponent === playerName) return;

          const oppScore = scoreNumber(opRow?.[j]);
          if (oppScore === null) return;

          if (!stats.opponents[opponent]) {
            stats.opponents[opponent] = {
              name: opponent,
              games: 0,
              wins: 0,
              losses: 0,
              draws: 0
            };
          }

          const duel = stats.opponents[opponent];
          duel.games++;
          if (target > 0 && oppScore < 0) {
            duel.wins++;
          } else if (target < 0 && oppScore > 0) {
            duel.losses++;
          } else {
            duel.draws++;
          }
        });
      });
    });

      stats.recent = stats.recent.slice(-10).reverse();
      stats.profileMonthName = profileMonthName;
      return stats;
    }

    function pct(wins, games) {
      return games ? `${((wins / games) * 100).toFixed(1)}%` : '-';
    }

    function rateClass(wins, games) {
      if (!games) return '';
      const rate = wins / games;
      return rate > 0.5 ? 'win' : (rate < 0.5 ? 'lose' : '');
    }

    function signedNumber(n) {
      if (!Number.isFinite(n)) return '-';
      return n > 0 ? `+${n}` : String(n);
    }

    function signedClass(n) {
      if (!Number.isFinite(n) || n === 0) return '';
      return n > 0 ? 'win' : 'lose';
    }

    function getOverallRank(playerName) {
      const data = globalData['總排名'];
      if (!data) return null;
      const limit = getColLimit(data, true);
      const rows = data.slice(2).filter(r => r[0]).map(r => {
        const total = Number(r[1]) || 0;
        const hasPart = r.slice(2, limit).some(v => v !== "" && v !== undefined && v !== "-" && String(v).trim() !== "");
        return { name: String(r[0]), total, hasPart };
      }).sort((a,b) => b.hasPart - a.hasPart || b.total - a.total);

      let rank = 1, displayRank = 1, prev = null;
      for (const r of rows) {
        if (!r.hasPart) continue;
        if (r.total !== prev) { displayRank = rank; prev = r.total; }
        if (r.name === playerName) return displayRank;
        rank++;
      }
      return null;
    }

    function renderProfileStats(stats) {
      const m = stats.month;
      const y = stats.year;

      const recentHtml = stats.recent.length
        ? stats.recent.map(g => {
            const cls = g.score > 0 ? 'win' : (g.score < 0 ? 'lose' : 'zero');
            const sign = g.score > 0 ? '+' : '';
            return `<div class="recent-game ${cls}" title="${escapeHtml(g.sheet)} ${escapeHtml(g.date)}">${sign}${g.score}</div>`;
          }).join('')
        : `<div class="profile-empty">暫無參加紀錄</div>`;

      const opponents = Object.values(stats.opponents)
        .filter(o => o.games >= 3)
        .map(o => ({
          ...o,
          rate: o.games ? o.wins / o.games : 0
        }))
        .sort((a, b) => a.rate - b.rate || b.games - a.games || a.name.localeCompare(b.name));

      const potentialNemesis = opponents[0] || null;
      const nemesis = (potentialNemesis && potentialNemesis.rate < 0.5) ? potentialNemesis : null;

      const potentialBenefactor = opponents.length ? opponents[opponents.length - 1] : null;
      const benefactor = (potentialBenefactor && potentialBenefactor.rate > 0.5) ? potentialBenefactor : null;

      let best = null, worst = null;
      if (y.scores.length > 0) {
        const maxScore = Math.max(...y.scores);
        const minScore = Math.min(...y.scores);

        best = maxScore > 0 ? maxScore : null;
        worst = minScore < 0 ? minScore : null;
      }

      const monthWinRateClass = rateClass(m.wins, m.games);
      const yearWinRateClass = rateClass(y.wins, y.games);
      const monthAvg = m.games ? Number((m.total / m.games).toFixed(1)) : null;
      const yearAvg = y.games ? Number((y.total / y.games).toFixed(1)) : null;

      document.getElementById('profileBody').innerHTML = `
        <section class="profile-section">
          <div class="profile-section-title">本月戰績 · ${escapeHtml(stats.profileMonthName || '-')}</div>
          <div class="profile-grid">
            <div class="profile-stat"><div class="profile-stat-label">對局</div><div class="profile-stat-value">${m.games}</div></div>
            <div class="profile-stat"><div class="profile-stat-label">勝率</div><div class="profile-stat-value ${monthWinRateClass}">${pct(m.wins, m.games)}</div></div>
            <div class="profile-stat"><div class="profile-stat-label">平均每局</div><div class="profile-stat-value ${signedClass(monthAvg)}">${monthAvg === null ? '-' : signedNumber(monthAvg)}</div></div>
            <div class="profile-stat"><div class="profile-stat-label">總分</div><div class="profile-stat-value ${signedClass(m.total)}">${signedNumber(m.total)}</div></div>
          </div>
        </section>

        <section class="profile-section">
          <div class="profile-section-title">2026 年度戰績</div>
          <div class="profile-grid">
            <div class="profile-stat"><div class="profile-stat-label">對局</div><div class="profile-stat-value">${y.games}</div></div>
            <div class="profile-stat"><div class="profile-stat-label">勝率</div><div class="profile-stat-value ${yearWinRateClass}">${pct(y.wins, y.games)}</div></div>
            <div class="profile-stat"><div class="profile-stat-label">平均每局</div><div class="profile-stat-value ${signedClass(yearAvg)}">${yearAvg === null ? '-' : signedNumber(yearAvg)}</div></div>
            <div class="profile-stat"><div class="profile-stat-label">總分</div><div class="profile-stat-value ${signedClass(y.total)}">${signedNumber(y.total)}</div></div>
          </div>
        </section>

        <section class="profile-section">
          <div class="profile-section-title">近期 10 場</div>
          <div class="recent-grid">${recentHtml}</div>
          <div class="recent-meta">
            <span>最新 → 最舊</span>
            <span>近 ${stats.recent.length} 場勝率 ${pct(stats.recent.filter(g => g.score > 0).length, stats.recent.length)}</span>
          </div>
        </section>

        <section class="profile-section">
          <div class="profile-section-title">魔鬼 / 天使</div>
          <div class="duel-grid">
            <div class="duel-card">
              <div class="duel-label">😈 魔鬼</div>
              ${nemesis
                ? `<div class="duel-opponent">${escapeHtml(nemesis.name)}</div>
                   <div class="duel-rate">勝率 ${pct(nemesis.wins, nemesis.games)}</div>
                   <div class="duel-note">共 ${nemesis.games} 場</div>`
                : `<div class="duel-opponent" style="text-align: center; margin-top: 12px; color: #8E8E93; font-weight: normal; font-size: 24px; line-height: 1.5;">-</div>`}
            </div>
            <div class="duel-card">
              <div class="duel-label">😇 天使</div>
              ${benefactor
                ? `<div class="duel-opponent">${escapeHtml(benefactor.name)}</div>
                   <div class="duel-rate">勝率 ${pct(benefactor.wins, benefactor.games)}</div>
                   <div class="duel-note">共 ${benefactor.games} 場</div>`
                : `<div class="duel-opponent" style="text-align: center; margin-top: 12px; color: #8E8E93; font-weight: normal; font-size: 24px; line-height: 1.5;">-</div>`}
            </div>
          </div>
        </section>

        <section class="profile-section">
          <div class="profile-section-title">最佳 / 最差單局</div>
          <div class="record-row"><div class="record-label">最佳單局</div><div class="record-value ${signedClass(best)}">${best === null ? '-' : signedNumber(best)}</div></div>
          <div class="record-row"><div class="record-label">最差單局</div><div class="record-value ${signedClass(worst)}">${worst === null ? '-' : signedNumber(worst)}</div></div>
        </section>
      `;
    }

    async function openPlayerProfile(playerName) {
      const token = ++profileRequestToken;
      document.getElementById('profileName').textContent = playerName;
      document.getElementById('profileSubtitle').textContent = '正在整理 2026 戰績…';
      document.getElementById('profileBody').innerHTML = `
        <section class="profile-section">
          <div class="sk-box" style="height:18px;width:35%;margin-bottom:12px;"></div>
          <div class="profile-grid">
            ${Array(4).fill('<div class="profile-stat"><div class="sk-box"style="height:12px;width:55%;margin-bottom:7px;"></div><div class="sk-box"style="height:20px;width:70%;"></div></div>').join('')}
          </div>
        </section>
        <section class="profile-section"><div class="sk-box" style="height:150px;width:100%;"></div></section>
      `;

      document.body.classList.add('profile-open');
      document.getElementById('profileBackdrop').classList.add('show');
      document.getElementById('profileSheet').classList.add('show');
      document.getElementById('profileBackdrop').setAttribute('aria-hidden', 'false');
      document.getElementById('profileSheet').setAttribute('aria-hidden', 'false');

      try {
        await Promise.all(allSheetNames.map(async sheetName => {
          if (!globalData[sheetName]) {
            if (!fetchPromises[sheetName]) {
              fetchPromises[sheetName] = fetch(`${API_URL}?sheet=${encodeURIComponent(sheetName)}`).then(res => res.json());
            }
            try {
              globalData[sheetName] = await fetchPromises[sheetName];
            } catch (err) {
              delete fetchPromises[sheetName];
              throw err;
            }
          }
        }));

        if (token !== profileRequestToken) return;

        const statSheets = allSheetNames
          .filter(name => name !== '總排名' && globalData[name])
          .map(name => ({ name, data: globalData[name] }));

        const stats = collectPlayerStats(playerName, statSheets);
        const currentRank = getOverallRank(playerName);

        document.getElementById('profileSubtitle').textContent =
          `${stats.profileMonthName || '2026 年'} · ${currentRank ? `目前總排名 ${currentRank}` : '玩家資料'}`;

        renderProfileStats(stats);
      } catch (err) {
        if (token !== profileRequestToken) return;
        document.getElementById('profileSubtitle').textContent = '載入失敗';
        document.getElementById('profileBody').innerHTML = `
          <section class="profile-section">
            <div class="error-container" style="padding:20px 10px;">
              玩家資料載入失敗：${escapeHtml(err.message)}
            </div>
          </section>`;
      }
    }

    function closePlayerProfile() {
      profileRequestToken++;
      document.body.classList.remove('profile-open');
      document.getElementById('profileBackdrop').classList.remove('show');
      document.getElementById('profileSheet').classList.remove('show');
      document.getElementById('profileBackdrop').setAttribute('aria-hidden', 'true');
      document.getElementById('profileSheet').setAttribute('aria-hidden', 'true');
    }

    document.getElementById('profileClose').addEventListener('click', closePlayerProfile);
    document.getElementById('profileBackdrop').addEventListener('click', closePlayerProfile);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closePlayerProfile();
    });

    document.addEventListener('click', e => {
      const menu = document.getElementById('monthSelectorMenu');
      const container = document.getElementById('dropdownContainer');
      if (menu && container && !container.contains(e.target)) menu.classList.remove('show');
    });

    let profileDrag = {
      active: false,
      startY: 0,
      currentY: 0,
      pointerId: null
    };

    function setupProfileDrag() {
      const sheet = document.getElementById('profileSheet');
      const body = document.getElementById('profileBody');

      sheet.addEventListener('touchstart', e => {
        if (window.innerWidth > 600 || !sheet.classList.contains('show') || e.touches.length !== 1) return;
        const touch = e.touches[0];
        const target = e.target;
        const fromHeader = !!target.closest('.profile-header') || !!target.closest('.profile-grabber');
        const bodyAtTop = body.scrollTop <= 0;
        if (!fromHeader && !bodyAtTop) return;
        profileDrag.active = true;
        profileDrag.startY = touch.clientY;
        profileDrag.currentY = touch.clientY;
        sheet.classList.add('dragging');
      }, { passive: true });

      sheet.addEventListener('touchmove', e => {
        if (!profileDrag.active || window.innerWidth > 600 || e.touches.length !== 1) return;
        const y = e.touches[0].clientY;
        const delta = Math.max(0, y - profileDrag.startY);
        profileDrag.currentY = y;
        if (delta > 0) {
          sheet.style.transform = `translateY(${delta}px)`;
        }
      }, { passive: true });

      sheet.addEventListener('touchend', () => {
        if (!profileDrag.active) return;
        const delta = Math.max(0, profileDrag.currentY - profileDrag.startY);
        profileDrag.active = false;
        sheet.classList.remove('dragging');
        sheet.style.transform = '';
        if (delta >= 120) closePlayerProfile();
      }, { passive: true });

      sheet.addEventListener('touchcancel', () => {
        profileDrag.active = false;
        sheet.classList.remove('dragging');
        sheet.style.transform = '';
      }, { passive: true });
    }

    let scrollTimers = { table: null, profile: null };
    document.addEventListener('scroll', (e) => {
      const cls = e.target.classList;
      if (cls && (cls.contains('table-container') || cls.contains('profile-body'))) {
        e.target.classList.add('scrolling');
        const key = cls.contains('table-container') ? 'table' : 'profile';
        clearTimeout(scrollTimers[key]);
        scrollTimers[key] = setTimeout(() => {
          e.target.classList.remove('scrolling');
        }, 1000);
      }
    }, true);

    setupProfileDrag();
    fetchData();
