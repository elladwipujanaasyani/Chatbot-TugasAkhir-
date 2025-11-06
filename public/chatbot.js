function toggleChatbot() {
  const chatbot = document.getElementById('chat-container');
  chatbot.classList.toggle('hidden');

  // Tampilkan auto-respon saat pertama kali dibuka
  const chatBox = document.getElementById('chat-box');
  if (!chatbot.classList.contains('hidden') && chatBox.innerHTML.trim() === '') {
    addMessage('bot', 'Hai !!! Saya siap bantu. Mau cari info apa hari ini ?');
  }
}

// Fungsi menambahkan bubble chat
function addMessage(sender, text) {
  const chatBox = document.getElementById('chat-box');
  const bubble = document.createElement('div');
  bubble.className = `bubble ${sender}`;
  bubble.innerHTML = text;
  chatBox.appendChild(bubble);
  chatBox.scrollTop = chatBox.scrollHeight;
  saveChat(); //simpan chat baru
}

// Fungsi konversi link jadi bisa diklik
function convertLinks(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);
}

// Fungsi kirim pesan ke server
async function sendMessage(message) {
  if (!message) return;

  addMessage('user', message);

  try {
    const res = await fetch('http://localhost:9000/api/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: message }) 
    });

    const data = await res.json();
    const jawaban = convertLinks(data.answer); 
    addMessage('bot', jawaban);
  } catch (err) {
    addMessage('bot', 'Maaf, terjadi kesalahan saat menghubungi server.');
  }
}

// === Simpan & restore chat ===
function saveChat() {
  const chatBox = document.getElementById('chat-box');
  sessionStorage.setItem('chatHistory', chatBox.innerHTML);
}

function restoreChat() {
  const chatBox = document.getElementById('chat-box');
  const savedChat = sessionStorage.getItem('chatHistory');
  if (savedChat) {
    chatBox.innerHTML = savedChat;
  }
}

// Hapus history saat reload (refresh F5)
window.addEventListener('beforeunload', () => {
  sessionStorage.removeItem('chatHistory');
});

// Kirim ketika form disubmit (klik tombol ATAU tekan Enter)
document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('user-input');

  restoreChat(); //restore isi chat ketika reload

  form.addEventListener('submit', function (event) {
    event.preventDefault(); // Biar gak reload
    const message = input.value.trim();
    if (message) {
      sendMessage(message);
      input.value = '';
    }
  });
});