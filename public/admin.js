let currentAdminUser = "";

// 1. Fungsi Login
document.getElementById('btnLoadQuestions').addEventListener('click', () => {
    let username = document.getElementById('adminUsername').value.trim().toLowerCase();
    if (!username) return alert("Masukkan Username!");
    
    currentAdminUser = username;
    document.getElementById('adminLoginPanel').classList.add('hidden');
    document.getElementById('adminDashboardPanel').classList.remove('hidden');
    document.getElementById('displayAdminUser').innerText = username;
    fetchQuestions();
    fetchPublishHistory();
});

// 2. Fungsi Ambil Daftar Soal Bank Lokal
async function fetchQuestions() {
    try {
        const res = await fetch(`/api/questions/${encodeURIComponent(currentAdminUser)}`);
        const questions = await res.json();
        const list = document.getElementById('questionList');
        list.innerHTML = "";
        
        questions.forEach((q, index) => {
            let li = document.createElement('li');
            li.innerHTML = `
                <div>
                    <strong>Q:</strong> ${q.q} <br>
                    <strong>A:</strong> ${q.a}
                </div>
                <button class="btn-delete" onclick="deleteQuestion(${index})">Hapus</button>
            `;
            list.appendChild(li);
        });
    } catch (error) {
        console.error("Error mengambil soal:", error);
    }
}

// 3. Fungsi Ambil Riwayat Kuis yang sudah di-publish ke Discover
async function fetchPublishHistory() {
    try {
        const res = await fetch(`/api/publish/history/${encodeURIComponent(currentAdminUser)}`);
        const history = await res.json();
        const list = document.getElementById('publishHistoryList');
        list.innerHTML = "";

        if(history.length === 0) {
            list.innerHTML = "<p style='color:#777; font-style:italic; font-size:0.9rem;'>Belum ada kuis yang di-publish.</p>";
            return;
        }

        history.forEach((quiz) => {
            let li = document.createElement('li');
            li.innerHTML = `
                <div>
                    <strong>Judul:</strong> ${quiz.title} [${quiz.category}]<br>
                    <small style="color:#555;">Total: ${quiz.questions.length} Soal</small>
                </div>
                <button class="btn-delete" style="background:#333; box-shadow:0 4px 0 #000;" onclick="deletePublishedQuiz('${quiz.id}')">Hapus dari Discover</button>
            `;
            list.appendChild(li);
        });
    } catch (error) {
        console.error("Error mengambil riwayat publish:", error);
    }
}

// 4. Tambah Manual ke Bank Lokal
document.getElementById('btnAddQuestion').addEventListener('click', async () => {
    const q = document.getElementById('newQuestion').value.trim();
    const a = document.getElementById('newAnswer').value.trim();
    
    if (!q || !a) {
        document.getElementById('adminError').innerText = "Mohon isi semua kolom!";
        return;
    }
    
    document.getElementById('adminError').innerText = "";
    try {
        await fetch(`/api/questions/${encodeURIComponent(currentAdminUser)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q, a })
        });
        
        document.getElementById('newQuestion').value = "";
        document.getElementById('newAnswer').value = "";
        fetchQuestions();
    } catch (error) {
        console.error("Error menambah soal:", error);
        alert("Gagal menyimpan soal ke server.");
    }
});

// 5. Hapus Soal dari Bank Lokal
async function deleteQuestion(index) {
    try {
        await fetch(`/api/questions/${encodeURIComponent(currentAdminUser)}/${index}`, { method: 'DELETE' });
        fetchQuestions();
    } catch (error) {
        console.error("Error menghapus soal:", error);
    }
}

// 6. Hapus Kuis dari Halaman Discover Publik
async function deletePublishedQuiz(quizId) {
    if(!confirm("Apakah Anda yakin ingin menghapus kuis ini dari menu Discover umum?")) return;
    try {
        const res = await fetch(`/api/publish/${encodeURIComponent(currentAdminUser)}/${quizId}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if(data.success) {
            alert(data.message);
            fetchPublishHistory();
        } else {
            alert("Gagal: " + data.error);
        }
    } catch (error) {
        console.error("Error hapus kuis publish:", error);
    }
}

// 7. Tambah via TXT
document.getElementById('btnUploadTxt').addEventListener('click', () => {
    const fileInput = document.getElementById('fileTxt');
    if (fileInput.files.length === 0) return alert("Pilih file .txt terlebih dahulu!");

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function(e) {
        const text = e.target.result;
        const lines = text.split('\n');
        let newQuestions = [];

        lines.forEach(line => {
            if (line.includes('|')) {
                const parts = line.split('|');
                const q = parts[0].trim();
                const a = parts[1].trim();
                if (q && a) newQuestions.push({ q, a });
            }
        });

        if (newQuestions.length === 0) {
            return alert("Tidak ada soal valid ditemukan. Pastikan format: Soal | Jawaban");
        }

        try {
            await fetch(`/api/questions/bulk/${encodeURIComponent(currentAdminUser)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questions: newQuestions })
            });

            fileInput.value = ""; 
            fetchQuestions();
            alert(`${newQuestions.length} soal berhasil diunggah!`);
        } catch (error) {
            console.error("Error upload file txt:", error);
            alert("Terjadi kesalahan saat mengunggah file.");
        }
    };

    reader.readAsText(file);
});

// 8. Fitur Publish ke Discover
document.getElementById('btnPublish').addEventListener('click', async () => {
    const title = document.getElementById('publishTitle').value.trim();
    const category = document.getElementById('publishCategory').value.trim();

    if (!title || !category) {
        return alert("Judul dan Kategori wajib diisi!");
    }

    try {
        const response = await fetch(`/api/publish/${encodeURIComponent(currentAdminUser)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, category })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server menolak dengan status ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        
        if (data.success) {
            alert("Berhasil! Kuis kamu sekarang tersedia di menu Discover.");
            document.getElementById('publishTitle').value = "";
            document.getElementById('publishCategory').value = "";
            fetchPublishHistory(); // Refresh riwayat otomatis
        } else {
            alert("Gagal: " + (data.error || "Alasan tidak diketahui"));
        }
    } catch (error) {
        console.error("🚨 LOG DETAIL ERROR PUBLISH:", error);
        alert("Gagal mem-publish kuis!\nDetail: " + error.message);
    }
});