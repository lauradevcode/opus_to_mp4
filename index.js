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
// ESSENCIAL para a conversão no frontend funcionar.
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
});

// ----------------------------------------------------
// 1. ROTAS PARA SERVIR ARQUIVOS ESTÁTICOS (Otimizado)
// ----------------------------------------------------

// Middleware para servir arquivos estáticos: 
// Ele serve 'style.css', 'frontend.js', e o 'index.html' por padrão na rota '/'.
app.use(express.static(path.join(__dirname)));

// Se você mantiver o app.use(express.static(__dirname)), 
// as rotas individuais abaixo se tornam redundantes:

/* // app.get('/style.css', ...)
// app.get('/frontend.js', ...)
*/

// Opcional: Rota raiz que garante que o index.html será servido, 
// embora express.static já faça isso. Manteremos para clareza.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// ----------------------------------------------------
// 2. ROTA DA API DE TRANSCRIÇÃO (Simulada)
// ----------------------------------------------------

// Rota para Transcrição
app.post('/transcribe', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado para transcrição.' });
    }

    const inputPath = req.file.path; 
    console.log(`[Transcription] Arquivo recebido em ${inputPath}`);

    // Simulação de tempo de processamento (5 segundos)
    setTimeout(() => {
        const simulatedTranscript = "Olá! A transcrição foi concluída com sucesso. Seu conversor está pronto! Não se esqueça de clicar no botão 'Copiar Chave' para doar se este recurso foi útil. Obrigado pelo apoio, Laura. ";

        // Limpa o arquivo temporário
        fs.unlink(inputPath, (err) => {
            if (err) console.error(`Erro ao limpar arquivo ${inputPath}:`, err);
            else console.log(`[Cleanup] Arquivo temporário ${inputPath} removido.`);
        }); 

        // Retorna a transcrição
        res.json({ text: simulatedTranscript });

    }, 5000); 
});

// ----------------------------------------------------
// 3. INÍCIO DO SERVIDOR
// ----------------------------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));