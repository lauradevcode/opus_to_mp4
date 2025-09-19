const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path'); // Novo: Importa o módulo path

// Vanilla JS app
const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: true });

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

let inputFile = null;
let mp4BlobUrl = null;

function log(msg) {
    logEl.textContent += msg + "\n";
    logEl.scrollTop = logEl.scrollHeight;
}

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

        // write input
        ffmpeg.FS('writeFile', 'input.opus', await fetchFile(inputFile));

        // poster
        const posterBlob = await createPoster(inputFile.name.replace(/\.[^.]+$/, ''));
        ffmpeg.FS('writeFile', 'poster.png', await fetchFile(posterBlob));

        statusEl.textContent = 'Convertendo para MP4...';
        log('Iniciando conversão...');

        try {
            await ffmpeg.run('-loop', '1', '-i', 'poster.png', '-i', 'input.opus', '-c:v', 'libx264', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-pix_fmt', 'yuv420p', '-movflags', 'faststart', 'out.mp4');
        } catch (e) {
            log('Falha com libx264 — tentativa de remux: ' + e.message);
            // fallback: try simple copy (may fail if codecs incompatible)
            await ffmpeg.run('-i', 'input.opus', '-c', 'copy', 'out.mp4');
        }

        const data = ffmpeg.FS('readFile', 'out.mp4');
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        if (mp4BlobUrl) URL.revokeObjectURL(mp4BlobUrl);
        mp4BlobUrl = URL.createObjectURL(blob);
        player.src = mp4BlobUrl;
        downloadBtn.disabled = false;
        statusEl.textContent = 'Conversão concluída.';
        log('Conversão finalizada.');
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

copyBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(transcriptEl.value);
        alert('Texto copiado.');
    } catch (e) { alert('Erro ao copiar: ' + e.message) }
});

// ---------- Transcrição: duas abordagens exemplar

// 1) Transcrever via microfone: instruções ao usuário para tocar o áudio e deixar o microfone captar
useMicBtn.addEventListener('click', async () => {
    if (!inputFile) return alert('Selecione um arquivo antes.');
    // This is a best-effort helper: open the audio in a new window and ask user to allow mic and play it near the mic.
    // Browser limitations prevent programmatic route of system audio to SpeechRecognition.
    alert('A transcrição via microfone é experimental: após OK, o áudio será reproduzido e você deve permitir o uso do microfone. O reconhecimento dependerá da qualidade do microfone e do ambiente.');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Create a SpeechRecognition if supported
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

        // play audio through system (user must allow) — we also attach the file to an audio element and play
        audioPlayer.src = URL.createObjectURL(inputFile);
        audioPlayer.play();

        // stop recognition when audio ends
        audioPlayer.onended = () => { recognition.stop(); stream.getTracks().forEach(t => t.stop()); alert('Reprodução finalizada — reconhecimento parado.'); };
    } catch (e) {
        log('Transcrição via microfone falhou: ' + e.message);
        alert('Erro ao acessar microfone: ' + e.message + '\nConsidere usar uma API de servidor para transcrição.');
    }
});

// 2) Enviar para API de transcrição (exemplo) — você precisa apontar para seu servidor que roda Whisper/WhisperX
serverBtn.addEventListener('click', async () => {
    if (!inputFile) return alert('Selecione um arquivo antes.');
    const confirmed = confirm('Este botão mostra um exemplo de como enviar o arquivo para uma API. Sem servidor, nada será feito. Deseja ver o exemplo?');
    if (!confirmed) return;
    // Example: the user must host an API endpoint that accepts multipart/form-data and returns JSON {text: "..."}
    const exampleUrl = 'https://sua-api-de-transcricao.exemplo/transcribe';
    const proceed = confirm('No exemplo você enviará o arquivo para: ' + exampleUrl + '\nSubstitua pela sua API ou crie uma instância que rode Whisper. OK para continuar?');
    if (!proceed) return;
    try {
        statusEl.textContent = 'Enviando para API...';
        const form = new FormData();
        form.append('file', inputFile);
        const res = await fetch(exampleUrl, { method: 'POST', body: form });
        if (!res.ok) throw new Error('Resposta da API: ' + res.status);
        const j = await res.json();
        transcriptEl.value = j.text || JSON.stringify(j);
        statusEl.textContent = 'Transcrição recebida.';
        log('Transcrição via servidor OK.');
    } catch (e) {
        statusEl.textContent = 'Falha ao enviar para API.';
        log('Erro ao enviar para API: ' + (e.message || e));
        alert('Erro ao enviar para API. Veja logs.');
    }
});

// Configuração do Multer
const upload = multer({ dest: 'uploads/', limits: { fileSize: 60 * 1024 * 1024 } });

const app = express();
app.use(cors());
app.use(express.json());

// Adiciona os cabeçalhos de isolamento (ESSENCIAL PARA SharedArrayBuffer)
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
});

// Rota Raiz: Serve o arquivo HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota para Transcrição
app.post('/transcribe', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado para transcrição.' });
    }

    const inputPath = req.file.path;
    console.log(`[Transcription] Arquivo recebido: ${req.file.originalname} em ${inputPath}`);

    // Simulação de tempo de processamento
    setTimeout(() => {
        const simulatedTranscript = "Olá, este é o texto transcrito pelo servidor. Esta função substitui a necessidade de FFmpeg para a conversão de áudio. Para a transcrição real, o código aqui chamaria um modelo de IA como o Whisper.";

        // Limpa o arquivo temporário
        fs.unlink(inputPath, (err) => {
            if (err) console.error(`Erro ao limpar arquivo ${inputPath}:`, err);
            else console.log(`[Cleanup] Arquivo temporário ${inputPath} removido.`);
        });

        res.json({ text: simulatedTranscript });
        console.log(`[Transcription] Simulação de transcrição enviada para o cliente.`);

    }, 5000);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));