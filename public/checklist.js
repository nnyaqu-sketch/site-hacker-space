async function loadLists(){
  const res = await fetch('/api/checklists');
  const lists = await res.json();
  const container = document.getElementById('lists');
  container.innerHTML = '';
  lists.forEach(l => {
    const el = document.createElement('div');
    el.className = 'checklist';
    el.innerHTML = `<h3>${escapeHtml(l.name)}</h3><p>${escapeHtml(l.description||'')}</p>`;
    const ul = document.createElement('ul');
    l.items.forEach(it => {
      const li = document.createElement('li');
      li.innerHTML = `<label><input type="checkbox" data-id="${it.id}" ${it.checked? 'checked':''}> ${escapeHtml(it.text)}</label>`;
      ul.appendChild(li);
    });
    el.appendChild(ul);
    const addInput = document.createElement('input'); addInput.placeholder='Add item';
    const addBtn = document.createElement('button'); addBtn.textContent='Add';
    addBtn.addEventListener('click', async ()=>{
      const text = addInput.value.trim(); if(!text) return; 
      await fetch(`/api/checklist/${l.id}/items`, { method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ text }) });
      loadLists();
    });
    el.appendChild(addInput); el.appendChild(addBtn);
    container.appendChild(el);
  });
}

document.getElementById('create-list').addEventListener('click', async ()=>{
  const name = document.getElementById('new-list-name').value.trim();
  const desc = document.getElementById('new-list-desc').value.trim();
  if (!name) return alert('name required');
  await fetch('/api/checklists', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ name, description: desc }) });
  document.getElementById('new-list-name').value='';
  document.getElementById('new-list-desc').value='';
  loadLists();
});

document.addEventListener('change', async (e)=>{
  if (e.target.matches('input[type=checkbox][data-id]')){
    const id = e.target.dataset.id;
    await fetch(`/api/checklist/items/${id}/toggle`, { method:'POST' });
    loadLists();
  }
});

function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// react to server updates via socket
const so = io('/public');
so.on('checklist-updated', loadLists);
so.on('announcement', ()=>{});

loadLists();
