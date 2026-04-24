
// Expenses Tracker - script.js
// Features:
// - Add / Edit / Delete expenses
// - Persist to localStorage
// - Filter by month, search
// - Export CSV, Delete all
// - Simple category "donut" mini-chart (SVG)

(() => {
  const LS_KEY = 'expenses_v1';
  const form = document.getElementById('expense-form');
  const idInput = document.getElementById('expense-id');
  const categoryInput = document.getElementById('category');
  const amountInput = document.getElementById('amount');
  const descInput = document.getElementById('description');
  const dateInput = document.getElementById('date');
  const saveBtn = document.getElementById('save-btn');
  const clearBtn = document.getElementById('clear-btn');

  const tableBody = document.querySelector('#expenses-table tbody');
  const totalMonthEl = document.getElementById('total-month');
  const totalAllEl = document.getElementById('total-all');
  const countAllEl = document.getElementById('count-all');
  const filterMonth = document.getElementById('filter-month');
  const searchInput = document.getElementById('search');
  const exportCsvBtn = document.getElementById('export-csv');
  const clearAllBtn = document.getElementById('clear-all');
  const miniChart = document.getElementById('mini-chart');

  let expenses = loadExpenses();

  // Initialize UI
  populateMonthFilter();
  render();

  // Form submit handler (add / update)
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = idInput.value || null;
    const category = categoryInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const description = descInput.value.trim();
    const date = dateInput.value;

    if (!category || !date || !amount || amount <= 0) {
      alert('Please fill in category, date and a valid amount.');
      return;
    }

    if (id) {
      // update
      const idx = expenses.findIndex(x => x.id === id);
      if (idx > -1) {
        expenses[idx] = { ...expenses[idx], category, amount, description, date };
      }
    } else {
      // add
      const newExp = {
        id: generateId(),
        category,
        amount,
        description,
        date
      };
      expenses.push(newExp);
    }
    saveExpenses();
    resetForm();
    render();
  });

  clearBtn.addEventListener('click', resetForm);

  searchInput.addEventListener('input', render);
  filterMonth.addEventListener('change', render);

  exportCsvBtn.addEventListener('click', () => {
    const rows = [['Date','Category','Description','Amount']];
    visibleExpenses().forEach(e => rows.push([e.date,e.category,e.description, e.amount.toFixed(2)]));
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    downloadBlob(csv, 'expenses.csv', 'text/csv;charset=utf-8;');
  });

  clearAllBtn.addEventListener('click', () => {
    if (!confirm('Delete ALL expenses? This cannot be undone.')) return;
    expenses = [];
    saveExpenses();
    render();
  });

  // Helpers

  function generateId(){
    // short random id
    return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  }

  function loadExpenses(){
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return defaultSample();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch {
      return [];
    }
  }

  function saveExpenses(){
    localStorage.setItem(LS_KEY, JSON.stringify(expenses));
  }

  function resetForm(){
    idInput.value = '';
    categoryInput.value = '';
    amountInput.value = '';
    descInput.value = '';
    dateInput.value = '';
    saveBtn.textContent = 'Add Expense';
  }

  function populateMonthFilter(){
    // add last 12 months plus 'all'
    const optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = 'All months';
    filterMonth.innerHTML = '';
    filterMonth.appendChild(optAll);

    const now = new Date();
    for (let i=0;i<18;i++){
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = d.toLocaleString(undefined,{month:'long', year:'numeric'});
      filterMonth.appendChild(opt);
    }
  }

  function visibleExpenses(){
    const q = searchInput.value.trim().toLowerCase();
    const monthVal = filterMonth.value;
    return expenses
      .filter(e => {
        if (monthVal !== 'all') {
          const [y,m] = monthVal.split('-');
          const eD = new Date(e.date);
          if (eD.getFullYear() !== +y || (eD.getMonth()+1) !== +m) return false;
        }
        if (!q) return true;
        return e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q);
      })
      .sort((a,b) => new Date(b.date) - new Date(a.date));
  }

  function render(){
    // table
    const list = visibleExpenses();
    tableBody.innerHTML = '';
    if (list.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="5" style="text-align:center;color:var(--muted)">No expenses found</td>`;
      tableBody.appendChild(tr);
    } else {
      for (const e of list) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${formatDate(e.date)}</td>
          <td>${escapeHtml(e.category)}</td>
          <td>${escapeHtml(e.description || '')}</td>
          <td>₹${Number(e.amount).toFixed(2)}</td>
          <td>
            <button class="action-btn" data-id="${e.id}" data-action="edit" title="Edit">
              ${iconEdit()}
            </button>
            <button class="action-btn" data-id="${e.id}" data-action="delete" title="Delete">
              ${iconTrash()}
            </button>
          </td>
        `;
        tableBody.appendChild(tr);
      }

      // attach action handlers (event delegation would also work)
      tableBody.querySelectorAll('.action-btn').forEach(btn => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        btn.addEventListener('click', () => {
          if (action === 'edit') fillFormForEdit(id);
          if (action === 'delete') deleteExpense(id);
        });
      });
    }

    // totals
    const totals = calculateTotals();
    totalMonthEl.textContent = `₹${totals.monthTotal.toFixed(2)}`;
    totalAllEl.textContent = `₹${totals.allTotal.toFixed(2)}`;
    countAllEl.textContent = `${expenses.length}`;

    // mini chart
    drawMiniChart();
  }

  function fillFormForEdit(id){
    const e = expenses.find(x => x.id === id);
    if (!e) return alert('Not found');
    idInput.value = e.id;
    categoryInput.value = e.category;
    amountInput.value = e.amount;
    descInput.value = e.description;
    dateInput.value = e.date;
    saveBtn.textContent = 'Save Changes';
    window.scrollTo({top:0, behavior:'smooth'});
  }

  function deleteExpense(id){
    if (!confirm('Delete this expense?')) return;
    expenses = expenses.filter(x => x.id !== id);
    saveExpenses();
    render();
  }

  function calculateTotals(){
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth();
    let monthTotal = 0;
    let allTotal = 0;
    for (const e of expenses){
      const amt = Number(e.amount) || 0;
      allTotal += amt;
      const d = new Date(e.date);
      if (d.getFullYear() === curY && d.getMonth() === curM) monthTotal += amt;
    }
    return { monthTotal, allTotal };
  }

  function drawMiniChart(){
    // aggregate by category (visible list)
    const visible = visibleExpenses();
    const map = new Map();
    for (const e of visible){
      map.set(e.category, (map.get(e.category) || 0) + Number(e.amount));
    }
    // clear
    miniChart.innerHTML = '';
    const total = Array.from(map.values()).reduce((a,b)=>a+b,0);
    if (total === 0) {
      miniChart.innerHTML = `<div style="color:var(--muted)">No data to chart</div>`;
      return;
    }

    // basic colored bars (no specific color required)
    const maxBar = 120;
    const frag = document.createDocumentFragment();
    Array.from(map.entries()).sort((a,b)=>b[1]-a[1]).slice(0,6).forEach(([cat,amt]) => {
      const pct = (amt/total);
      const item = document.createElement('div');
      item.style.minWidth = '0';
      item.style.flex = '1 1 auto';
      item.style.fontSize = '12px';
      item.innerHTML = `
        <div style="font-weight:600">${escapeHtml(cat)}</div>
        <div style="height:10px;border-radius:6px;background:linear-gradient(90deg, rgba(79,70,229,0.16), rgba(79,70,229,0.06));margin-top:6px;overflow:hidden">
          <div style="height:100%; width:${Math.max(6, Math.round(pct*100))}%;"></div>
        </div>
        <div style="opacity:0.8;margin-top:6px;font-size:11px">₹${amt.toFixed(0)} • ${Math.round(pct*100)}%</div>
      `;
      frag.appendChild(item);
    });
    miniChart.appendChild(frag);
  }

  function formatDate(d){
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'});
    } catch { return d }
  }

  function escapeHtml(s){
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function iconEdit(){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 21v-3.2l10.2-10.2 3.2 3.2L7.2 21H4zM20.7 7.3a1 1 0 0 0 0-1.4l-2.6-2.6a1 1 0 0 0-1.4 0l-1.6 1.6 3.2 3.2 1.4-1z" /></svg>`;
  }

  function iconTrash(){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18"/><path d="M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6"/><path d="M10 11v6M14 11v6"/></svg>`;
  }

  function downloadBlob(content, filename, mime){
    const blob = new Blob([content], {type: mime});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function defaultSample(){
    // helpful sample data to get started (only if localStorage empty)
    return [
      { id: generateId(), category: 'Food', amount: 150.00, description: 'Breakfast', date: todayOffset(-2) },
      { id: generateId(), category: 'Transport', amount: 60.00, description: 'Auto-rickshaw', date: todayOffset(-1) },
      { id: generateId(), category: 'Groceries', amount: 480.00, description: 'Weekly groceries', date: todayOffset(-7) }
    ];
  }

  function todayOffset(daysBack=0){
    const d = new Date();
    d.setDate(d.getDate() + daysBack);
    return d.toISOString().slice(0,10);
  }

})();