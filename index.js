const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path'); // Novo: Importa o módulo path

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