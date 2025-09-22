const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path'); 

// Configuração do Multer para lidar com upload de arquivos. 
// Cria a pasta 'uploads/' para arquivos temporários.
const upload = multer({ dest: 'uploads/', limits: { fileSize: 60 * 1024 * 1024 } }); 

const app = express();
app.use(cors()); 
app.use(express.json());

// Middleware de segurança para habilitar SharedArrayBuffer (necessário para ffmpeg.wasm)
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
});

// ----------------------------------------------------
// 1. ROTAS PARA SERVIR ARQUIVOS ESTÁTICOS
// ----------------------------------------------------

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// ----------------------------------------------------
// 2. ROTA DA API DE TRANSCRIÇÃO (Pronta para API Real)
// ----------------------------------------------------

// Rota para Transcrição - AGORA É ASYNC
app.post('/transcribe', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado para transcrição.' });
    }

    const inputPath = req.file.path; 
    console.log(`[Transcription] Arquivo recebido em ${inputPath}`);

    try {
        // ------------------------------------------------------------------
        // === PASSO CHAVE: INTEGRE SUA LÓGICA DE API AQUI ===
        // 
        // 1. O arquivo de áudio temporário está em: inputPath
        // 2. Transfira o arquivo para sua API (Whisper, Google, etc.).
        // 3. Obtenha o resultado da transcrição.
        // 
        // SUBSTITUA a linha abaixo pela sua chamada de API real.
        // Ex: const transcribedText = await callTranscriptionService(inputPath);
        
        const transcribedText = "SUBSTITUA-ME! Insira a transcrição real aqui.";
        
        // ------------------------------------------------------------------


        // Retorna a transcrição
        res.json({ text: transcribedText });

    } catch (error) {
        console.error('Erro no processamento da transcrição:', error);
        res.status(500).json({ error: 'Erro no servidor ao tentar transcrever o áudio.' });
        
    } finally {
        // Limpa o arquivo temporário (SEMPRE deve ser feito)
        fs.unlink(inputPath, (err) => {
            if (err) console.error(`Erro ao limpar arquivo ${inputPath}:`, err);
            else console.log(`[Cleanup] Arquivo temporário ${inputPath} removido.`);
        });
    }
});

// ----------------------------------------------------
// 3. INÍCIO DO SERVIDOR
// ----------------------------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));