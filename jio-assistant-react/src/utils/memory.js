const KEY = 'jio_chat_memory';

export function loadMemory() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
  catch { return {}; }
}

export function saveMemory(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); }
  catch {}
}

export function getChatsForUser(uid) {
  const mem = loadMemory();
  return mem[uid] || [];
}

export function saveChat(uid, chat) {
  const mem = loadMemory();
  if (!mem[uid]) mem[uid] = [];
  const idx = mem[uid].findIndex(c => c.id === chat.id);
  if (idx >= 0) mem[uid][idx] = chat;
  else mem[uid].unshift(chat);
  saveMemory(mem);
}

export function deleteChat(uid, chatId) {
  const mem = loadMemory();
  if (mem[uid]) mem[uid] = mem[uid].filter(c => c.id !== chatId);
  saveMemory(mem);
}

export function clearChats(uid) {
  const mem = loadMemory();
  mem[uid] = [];
  saveMemory(mem);
}
