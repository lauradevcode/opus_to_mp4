// A variável FFmpeg é definida pelo script CDN carregado no index.html.
const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: true });

// ENVOLVEMOS TODO O CÓDIGO AQUI PARA GARANTIR QUE OS ELEMENTOS HTML JÁ EXISTAM
document.addEventListener('DOMContentLoaded', () => {

    // TODAS AS SUAS VARIÁVEIS document.getElementById DEVEM ESTAR AQUI DENTRO
    const fileInput = document.getElementById('file');
    const filenameLabel = document.getElementById('filename');
    const convertBtn = document.getElementById('convertBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const statusEl = document.getElementById('status');
    const logEl = document.getElementById('log');
    const player = document.getElementById('player');
    const audioPlayer = document.getElementById('audioplayer');
    const transcriptEl = document.getElementById('transcript');
    const copyBtn = document.getElementById('copyBtn');
    const useMicBtn = document.getElementById('useMic');
    const serverBtn = document.getElementById('serverBtn');

    // Pop-up elements
    const popup = document.getElementById('donation-popup');
    const closePopup = document.getElementById('close-popup');
    const copyPixBtn = document.getElementById('copy-pix');
    const pixKeyInput = document.getElementById('pix-key');

    let inputFile = null;
    let mp4BlobUrl = null;

    function log(msg) {
        logEl.textContent += msg + "\n";
        logEl.scrollTop = logEl.scrollHeight;
    }

    // ----------------------------------------------------
    // 1. Lógica do PIX (Doação)
    // ----------------------------------------------------

    closePopup.addEventListener('click', () => {
        popup.classList.remove('active');
    });

    copyPixBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(pixKeyInput.value);
            copyPixBtn.textContent = 'Copiado! ✅';
            setTimeout(() => copyPixBtn.textContent = 'Copiar Chave', 2000);
        } catch (e) {
            alert('Erro ao copiar: ' + e.message);
        }
    });

    // ----------------------------------------------------
    // 2. Lógica da Conversão (FFmpeg WASM)
    // ----------------------------------------------------

    fileInput.addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (!f) return;
        inputFile = f;
        filenameLabel.textContent = f.name + ' (' + Math.round(f.size / 1024) + ' KB)';
        audioPlayer.src = URL.createObjectURL(f);
        player.src = '';
        mp4BlobUrl = null;
        downloadBtn.disabled = true;
        transcriptEl.value = '';
        log('Arquivo selecionado: ' + f.name);
    });

    async function ensureFFmpeg() {
        if (!ffmpeg.isLoaded()) {
            statusEl.textContent = 'Carregando ffmpeg.wasm (pode demorar)...';
            await ffmpeg.load();
            statusEl.textContent = 'ffmpeg carregado.';
            log('ffmpeg.wasm carregado.');
        }
    }

    async function createPoster(title) {
        const c = document.createElement('canvas');
        c.width = 1280; c.height = 720;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#071025'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '72px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, c.width / 2, c.height / 2);
        return await new Promise(res => c.toBlob(res, 'image/png'));
    }

    convertBtn.addEventListener('click', async () => {
        if (!inputFile) return alert('Escolha um arquivo .opus antes.');
        try {
            convertBtn.disabled = true;
            statusEl.textContent = 'Preparando...';
            await ensureFFmpeg();
            
            transcriptEl.value = 'Transcreva via servidor para obter o texto aqui...';

            ffmpeg.FS('writeFile', 'input.opus', await fetchFile(inputFile));

            const posterBlob = await createPoster(inputFile.name.replace(/\.[^.]+$/, ''));
            ffmpeg.FS('writeFile', 'poster.png', await fetchFile(posterBlob));

            statusEl.textContent = 'Convertendo para MP4...';
            log('Iniciando conversão...');

            try {
                // Tenta conversão com libx264 (mais robusto)
                await ffmpeg.run('-loop', '1', '-i', 'poster.png', '-i', 'input.opus', '-c:v', 'libx264', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-pix_fmt', 'yuv420p', '-movflags', 'faststart', 'out.mp4');
            } catch (e) {
                // Em caso de falha, tenta remux simples (copiar streams)
                log('Falha com libx264 — tentativa de remux: ' + e.message);
                await ffmpeg.run('-i', 'input.opus', '-c', 'copy', 'out.mp4');
            }

            const data = ffmpeg.FS('readFile', 'out.mp4');
            const blob = new Blob([data.buffer], { type: 'video/mp4' });
            if (mp4BlobUrl) URL.revokeObjectURL(mp4BlobUrl);
            mp4BlobUrl = URL.createObjectURL(blob);
            player.src = mp4BlobUrl;
            downloadBtn.disabled = false;
            statusEl.textContent = 'Conversão concluída. Use o botão "Transcrever" para obter o texto.';
            log('Conversão finalizada.');
            
            // Exibir pop-up após conversão
            popup.classList.add('active'); 

        } catch (err) {
            console.error(err);
            log('Erro: ' + (err.message || err));
            statusEl.textContent = 'Erro durante conversão. Veja logs.';
        } finally {
            convertBtn.disabled = false;
        }
    });

    downloadBtn.addEventListener('click', () => {
        if (!mp4BlobUrl) return;
        const a = document.createElement('a');
        a.href = mp4BlobUrl;
        a.download = (inputFile?.name?.replace(/\.[^.]+$/, '') || 'output') + '.mp4';
        document.body.appendChild(a);
        a.click();
        a.remove();
    });

    // ----------------------------------------------------
    // 3. Lógica da Transcrição (API Server)
    // ----------------------------------------------------

    serverBtn.addEventListener('click', async () => {
        if (!inputFile) return alert('Selecione um arquivo .opus antes.');
        
        // Mantenha 'http://localhost:3000' para testes locais.
        // Mude para a URL do Render (ex: https://[seunome].onrender.com/transcribe) após o deploy.
        const apiUrl = 'http://localhost:3000/transcribe'; 

        const proceed = confirm(`O arquivo será enviado para o servidor API (${apiUrl}). OK para continuar?`);
        if (!proceed) return;
        
        try {
            serverBtn.disabled = true;
            statusEl.textContent = 'Enviando para API e aguardando transcrição...';
            transcriptEl.value = 'Aguarde, transcrição em andamento no servidor...';
            
            const form = new FormData();
            form.append('file', inputFile);
            
            const res = await fetch(apiUrl, { method: 'POST', body: form });
            
            if (!res.ok) throw new Error('Resposta da API: ' + res.status);
            
            const j = await res.json();
            
            transcriptEl.value = j.text || 'Erro: API não retornou o campo "text".';
            
            statusEl.textContent = 'Transcrição recebida do servidor.';
            log('Transcrição via servidor OK.');
        } catch (e) {
            statusEl.textContent = 'Falha ao enviar para API.';
            log('Erro ao enviar para API: ' + (e.message || e));
            alert('Erro ao enviar para API. Verifique se o seu servidor Node.js/Render está ativo.');
        } finally {
            serverBtn.disabled = false;
        }
    });

    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(transcriptEl.value);
            alert('Texto copiado.');
        } catch (e) { alert('Erro ao copiar: ' + e.message) }
    });

    // Lógica de Transcrição via Microfone (mantida do código original)
    useMicBtn.addEventListener('click', async () => {
        if (!inputFile) return alert('Selecione um arquivo antes.');
        alert('A transcrição via microfone é experimental: após OK, o áudio será reproduzido e você deve permitir o uso do microfone.');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) return alert('Web Speech API não suportada no seu navegador. Use uma API de servidor para transcrição mais precisa.');
            const recognition = new SpeechRecognition();
            recognition.lang = 'pt-BR';
            recognition.interimResults = true;
            recognition.continuous = true;
            recognition.onresult = (ev) => {
                let text = '';
                for (let i = 0; i < ev.results.length; i++) text += ev.results[i][0].transcript + (ev.results[i].isFinal ? '\n' : '');
                transcriptEl.value = text;
            };
            recognition.onerror = (e) => log('SpeechRecognition error: ' + e.error);
            recognition.start();

            audioPlayer.src = URL.createObjectURL(inputFile);
            audioPlayer.play();

            audioPlayer.onended = () => { recognition.stop(); stream.getTracks().forEach(t => t.stop()); alert('Reprodução finalizada — reconhecimento parado.'); };
        } catch (e) {
            log('Transcrição via microfone falhou: ' + e.message);
            alert('Erro ao acessar microfone: ' + e.message + '\nConsidere usar uma API de servidor para transcrição.');
        }
    });

}); // <--- FIM do DOMContentLoaded