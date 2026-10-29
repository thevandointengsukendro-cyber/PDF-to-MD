import type { SamplePdfPreset } from '../types.ts';

export const SAMPLE_PDF_PRESETS: SamplePdfPreset[] = [
  {
    id: 'preset-01',
    originalName: '01_Arsitektur_Transformer_Spasial.pdf',
    outputName: '01-arsitektur-transformer-spasial.md',
    fileSizeBytes: 428_400,
    pageCount: 6,
    title: 'Bab 1: Arsitektur Transformer Spasial & Mekanisme Atensi Multi-Skala',
    category: 'Kecerdasan Buatan',
    rawTextLayer: `# Bab 1: Arsitektur Transformer Spasial & Mekanisme Atensi Multi-Skala

<!-- Halaman 1 -->

## 1.1 Formulasi Representasi Token Spasial

Misalkan sebuah halaman dokumen masukan direpresentasikan sebagai tensor citra $I \\in \\mathbb{R}^{H \\times W \\times C}$ dengan resolusi tinggi. Tahap pertama membagi bidang halaman menjadi kisi-kisi petak (*patch*) berukuran $P \\times P$ tanpa tumpang tindih, sehingga menghasilkan barisan vektor fitur visual $X_v = \\{x_v^{(1)}, x_v^{(2)}, \\dots, x_v^{(N)}\\}$ dengan $N = HW / P^2$.

Setiap petak visual diproyeksikan secara linear menggunakan matriks bobot $W_E \\in \\mathbb{R}^{(P^2 C) \\times d_{\\text{model}}}$ dan ditambahkan penyematan posisi dua dimensi (*2D positional encoding*) berdasarkan koordinat kotak pembatas $(x_i, y_i, w_i, h_i)$:

$$z_0 = \\left[ x_v^{(1)} W_E; \\, x_v^{(2)} W_E; \\, \\dots; \\, x_v^{(N)} W_E \\right] + E_{\\text{pos}}(x, y, w, h)$$

### [Gambar Halaman 1] Diagram Alir Ekstraksi Dual-Stream (Foto Halaman + Lapisan Teks)

> **Transkripsi Visual Gambar 1.1:** Diagram blok arsitektur dua jalur paralel. Jalur Atas: *Raster Page Image (300 DPI)* $\\rightarrow$ *2D Patch Partition ($16 \\times 16$)* $\\rightarrow$ *Spatial Vision Encoder (12 Lapisan)* $\\rightarrow$ *Deteksi Koordinat Gambar, Tabel & Blok Rumus*. Jalur Bawah: *PDF Vector Text Stream* $\\rightarrow$ *Tokenisasi Karakter & Posisi $(x,y)$* $\\rightarrow$ *Cross-Modal Alignment Module* $\\rightarrow$ *Output Markdown 1:1 Verbatim*.

<!-- Halaman 2 -->

## 1.2 Mekanisme Cross-Attention Visual dan Teks

Untuk menjamin tidak ada karakter, subskrip, maupun simbol integral yang hilang pada saat konversi, matriks *Query* diambil dari representasi token visual $Q_v = Z_v W_Q$, sedangkan matriks *Key* dan *Value* dibangun dari aliran teks vektor $K_t = Z_t W_K$ serta $V_t = Z_t W_V$. Fungsi atensi lintas-modalitas didefinisikan secara eksak sebagai berikut:

$$\\text{Attention}(Q_v, K_t, V_t) = \\text{softmax}\\left(\\frac{Q_v K_t^T}{\\sqrt{d_k}} + B_{\\text{spasial}}\\right) V_t$$

di mana $B_{\\text{spasial}} \\in \\mathbb{R}^{N_v \\times N_t}$ adalah matriks bias jarak Euclidean antar pusat kotak pembatas token visual ke-$i$ dan token teks ke-$j$:

$$B_{\\text{spasial}}(i, j) = -\\gamma \\left\\| \\mathbf{c}_i^{\\text{visual}} - \\mathbf{c}_j^{\\text{teks}} \\right\\|_2^2$$

<!-- Halaman 3 -->

## 1.3 Hasil Evaluasi Kuantitatif Transkripsi Dokumen

Tabel 1.1 di bawah ini menyajikan hasil pengukuran empiris pada 1.250 halaman dokumen ilmiah yang memuat rumus matematika bertingkat, matriks padat, dan tabel multi-kolom.

| Metode Konversi | Edit Distance (NED) | Akurasi Karakter 1:1 (%) | Presisi Rumus LaTeX (%) | Retensi Elemen Gambar (%) |
| :--- | ---: | ---: | ---: | ---: |
| OCR Sekuensial Standar | 0.088 | 91.2 | 64.5 | 12.0 |
| Ekstraksi Stream Teks Mentah | 0.052 | 94.8 | 71.0 | 0.0 |
| **Dual-Pass Visual + Teks 1:1** | **0.004** | **99.6** | **98.9** | **100.0** |`,
    visualElements: [
      {
        page: 1,
        type: 'figure',
        label: 'Diagram Alir Ekstraksi Dual-Stream (Foto Halaman + Lapisan Teks)',
        content: 'Diagram blok arsitektur dua jalur paralel Vision Encoder dan PDF Vector Text Stream.',
      },
      {
        page: 2,
        type: 'equation',
        label: 'Rumus Scaled Dot-Product Cross-Attention Spasial',
        content: '$$\\text{Attention}(Q_v, K_t, V_t) = \\text{softmax}\\left(\\frac{Q_v K_t^T}{\\sqrt{d_k}} + B_{\\text{spasial}}\\right) V_t$$',
      },
      {
        page: 3,
        type: 'table',
        label: 'Tabel 1.1 Hasil Evaluasi Kuantitatif Transkripsi Dokumen',
        content: '| Metode Konversi | Akurasi Karakter 1:1 (%) | Presisi Rumus LaTeX (%) |\n| :--- | ---: | ---: |\n| Dual-Pass Visual + Teks 1:1 | 99.6 | 98.9 |',
      },
    ],
  },
  {
    id: 'preset-02',
    originalName: '02_Dinamika_Fluida_Navier_Stokes.pdf',
    outputName: '02-dinamika-fluida-navier-stokes.md',
    fileSizeBytes: 512_900,
    pageCount: 8,
    title: 'Bab 2: Pemodelan Numerik Aliran Turbulen & Persamaan Navier-Stokes',
    category: 'Fisika Komputasi',
    rawTextLayer: `# Bab 2: Pemodelan Numerik Aliran Turbulen & Persamaan Navier-Stokes

<!-- Halaman 1 -->

## 2.1 Persamaan Pengatur Konservasi Massa dan Momentum

Untuk fluida Newtonian inkompresibel dengan kerapatan massa konstan $\\rho$ dan viskositas dinamik $\\mu$, hukum kekekalan massa dan momentum linear dinyatakan melalui sistem persamaan diferensial parsial Navier-Stokes:

$$\\nabla \\cdot \\mathbf{u} = \\frac{\\partial u_x}{\\partial x} + \\frac{\\partial u_y}{\\partial y} + \\frac{\\partial u_z}{\\partial z} = 0$$

$$\\rho \\left( \\frac{\\partial \\mathbf{u}}{\\partial t} + (\\mathbf{u} \\cdot \\nabla) \\mathbf{u} \\right) = -\\nabla p + \\mu \\nabla^2 \\mathbf{u} + \\mathbf{f}_{\\text{eksternal}}$$

Dalam bentuk komponen kartesian tiga dimensi, suku konveksi non-linear $(\\mathbf{u} \\cdot \\nabla)\\mathbf{u}$ menjabarkan transpor momentum oleh medan kecepatan itu sendiri. Bilangan tak berdimensi Reynolds didefinisikan sebagai rasio gaya inersia terhadap gaya viskos:

$$\\text{Re} = \\frac{\\rho U_0 L}{\\mu} = \\frac{U_0 L}{\\nu}$$

<!-- Halaman 2 -->

## 2.2 Diskritisasi Volume Hingga & Skema Koreksi Tekanan SIMPLE

Pada kisi tergeser (*staggered grid*), variabel tekanan $p_{i,j}$ disimpan pada pusat sel kontrol $\\Omega_{i,j}$, sedangkan komponen kecepatan $u_{i+1/2,j}$ dan $v_{i,j+1/2}$ dievaluasi tepat pada permukaan batas sel.

### [Gambar Halaman 2] Kontur Kecepatan Vorteks pada Saluran Mikro Silinder

> **Transkripsi Visual Gambar 2.1:** Plot kontur medan magnitudo kecepatan $|\\mathbf{u}|$ (m/s) di sekitar silinder berdiameter $D = 2.0\\text{ mm}$ pada $\\text{Re} = 2450$. Garis arus (*streamlines*) menunjukkan pemisahan lapisan batas pada sudut $\\theta_s = 82^\\circ$ dan pembentukan jalan vorteks Kármán (*Kármán vortex street*) dengan frekuensi pelepasan $f_s = 194\\text{ Hz}$.`,
    visualElements: [
      {
        page: 1,
        type: 'equation',
        label: 'Persamaan Momentum Navier-Stokes Inkompresibel',
        content: '$$\\rho \\left( \\frac{\\partial \\mathbf{u}}{\\partial t} + (\\mathbf{u} \\cdot \\nabla) \\mathbf{u} \\right) = -\\nabla p + \\mu \\nabla^2 \\mathbf{u} + \\mathbf{f}_{\\text{eksternal}}$$',
      },
      {
        page: 2,
        type: 'figure',
        label: 'Kontur Kecepatan Vorteks pada Saluran Mikro Silinder',
        content: 'Plot kontur medan kecepatan fluida di sekitar silinder dengan jalan vorteks Kármán.',
      },
    ],
  },
  {
    id: 'preset-03',
    originalName: '03_Kriptografi_Kurva_Eliptik_ZK.pdf',
    outputName: '03-kriptografi-kurva-eliptik-zk.md',
    fileSizeBytes: 389_200,
    pageCount: 5,
    title: 'Bab 3: Protokol Zero-Knowledge Proof pada Kurva Eliptik BN254',
    category: 'Keamanan Siber',
    rawTextLayer: `# Bab 3: Protokol Zero-Knowledge Proof pada Kurva Eliptik BN254

<!-- Halaman 1 -->

## 3.1 Grup Kurva Eliptik Atas Medan Hingga & Pasangan Bilinear

Kurva eliptik Barreto-Naehrig BN254 didefinisikan atas medan prima $\\mathbb{F}_p$ dengan persamaan Weierstrass pendek:

$$E(\\mathbb{F}_p) : y^2 = x^3 + 3 \\pmod p$$

Misalkan $\\mathbb{G}_1 = E(\\mathbb{F}_p)[r]$ dan $\\mathbb{G}_2 \\subset E(\\mathbb{F}_{p^2})[r]$ adalah subgrup torsi berorde prima $r$. Peta pasangan bilinear optimal Ate $e : \\mathbb{G}_1 \\times \\mathbb{G}_2 \\rightarrow \\mathbb{G}_T$ memenuhi sifat bilinearitas non-degenerat untuk setiap skalar $\\alpha, \\beta \\in \\mathbb{F}_r$:

$$e\\left([\\alpha]P, \\, [\\beta]Q\\right) = e(P, Q)^{\\alpha \\beta}$$

<!-- Halaman 2 -->

## 3.2 Komitmen Polinomial KZG (Kate-Zaverucha-Goldberg)

Untuk mengikat polinomial $f(X) = \\sum_{i=0}^{d} c_i X^i \\in \\mathbb{F}_r[X]$ berderajat maksimum $d$ menggunakan parameter tepercaya $\\text{SRS} = \\left([1]_1, [\\tau]_1, [\\tau^2]_1, \\dots, [\\tau^d]_1, [1]_2, [\\tau]_2\\right)$, komitmen dihitung sebagai:

$$C = [f(\\tau)]_1 = \\sum_{i=0}^{d} c_i [\\tau^i]_1$$

Untuk membuktikan bahwa $f(z) = y$ pada titik evaluasi publik $z \\in \\mathbb{F}_r$, *Prover* menghitung polinomial hasil bagi $q(X) = \\frac{f(X) - y}{X - z}$ dan mengirimkan bukti $\\pi = [q(\\tau)]_1$. *Verifier* memeriksa persamaan pairing berikut dalam satu langkah:

$$e\\left(C - [y]_1, \\, [1]_2\\right) = e\\left(\\pi, \\, [\\tau - z]_2\\right)$$

### [Gambar Halaman 2] Skema Interaksi Prover-Verifier KZG

> **Transkripsi Visual Gambar 3.1:** Diagram protokol 3-tahap: (1) *Prover* mengirim komitmen $C \\in \\mathbb{G}_1$ (48 byte); (2) *Verifier* mengirim tantangan acak $z \\in \\mathbb{F}_r$; (3) *Prover* mengirim evaluasi $y = f(z)$ beserta bukti $\\pi = [q(\\tau)]_1$, lalu *Verifier* memvalidasi kesamaan pairing dalam 1.8 ms.

| Skema ZKP | Ukuran Bukti (Byte) | Waktu Pembuktian (detik) | Waktu Verifikasi (ms) |
| :--- | ---: | ---: | ---: |
| Groth16 (BN254) | 192 | 1.45 | 1.8 |
| PLONK + KZG | 576 | 2.10 | 3.4 |
| Halo2 (IPA) | 3,456 | 3.80 | 11.6 |`,
    visualElements: [
      {
        page: 1,
        type: 'equation',
        label: 'Persamaan Kurva Eliptik & Bilinear Pairing',
        content: '$$e\\left([\\alpha]P, \\, [\\beta]Q\\right) = e(P, Q)^{\\alpha \\beta}$$',
      },
      {
        page: 2,
        type: 'figure',
        label: 'Skema Interaksi Prover-Verifier KZG',
        content: 'Diagram protokol 3-tahap antara Prover dan Verifier pada komitmen polinomial KZG.',
      },
      {
        page: 2,
        type: 'table',
        label: 'Tabel Benchmark Skema ZKP',
        content: '| Skema ZKP | Ukuran Bukti (Byte) | Waktu Verifikasi (ms) |\n| :--- | ---: | ---: |\n| Groth16 (BN254) | 192 | 1.8 |',
      },
    ],
  },
  {
    id: 'preset-04',
    originalName: '04_Termodinamika_Baterai_Solid_State.pdf',
    outputName: '04-termodinamika-baterai-solid-state.md',
    fileSizeBytes: 615_000,
    pageCount: 7,
    title: 'Bab 4: Kinetika Elektrokimia & Difusi Ion Litium pada Elektrolit Padat',
    category: 'Teknik Energi',
    rawTextLayer: `# Bab 4: Kinetika Elektrokimia & Difusi Ion Litium pada Elektrolit Padat

<!-- Halaman 1 -->

## 4.1 Persamaan Kinetika Antarmuka Butler-Volmer

Laju transfer muatan elektrokimia pada antarmuka elektroda-elektrolit padat $\\text{Li} / \\text{Li}_7\\text{La}_3\\text{Zr}_2\\text{O}_{12}$ (LLZO) dikendalikan oleh potensial lebih aktivasi $\\eta = \\Phi_s - \\Phi_e - U_{\\text{eq}}$ sesuai persamaan Butler-Volmer:

$$j = j_0 \\left[ \\exp\\left(\\frac{\\alpha_a F \\eta}{RT}\\right) - \\exp\\left(-\\frac{\\alpha_c F \\eta}{RT}\\right) \\right]$$

Sementara itu, fluks difusi ion $\\text{Li}^+$ di dalam kisi kristal garnet mengikuti hukum Fick kedua dengan koefisien difusi efektif $D_{\\text{eff}}(T) = D_0 \\exp(-E_a / k_B T)$:

$$\\frac{\\partial c_{\\text{Li}}}{\\partial t} = \\nabla \\cdot \\left( D_{\\text{eff}} \\nabla c_{\\text{Li}} \\right)$$

### [Gambar Halaman 2] Mikrograf SEM Penampang Antarmuka Li-Garnet LLZO

> **Transkripsi Visual Gambar 4.1:** Citra mikroskop elektron pemindaian (SEM) perbesaran $5000\\times$ (skala batang $10\\,\\mu\\text{m}$) memperlihatkan antarmuka bebas rongga antara anoda logam Litium, lapisan penyangga $\\text{ZnO}$ setebal $25\\text{ nm}$, dan elektrolit keramik padat LLZO.`,
    visualElements: [
      {
        page: 1,
        type: 'equation',
        label: 'Persamaan Butler-Volmer & Difusi Fick',
        content: '$$j = j_0 \\left[ \\exp\\left(\\frac{\\alpha_a F \\eta}{RT}\\right) - \\exp\\left(-\\frac{\\alpha_c F \\eta}{RT}\\right) \\right]$$',
      },
      {
        page: 2,
        type: 'figure',
        label: 'Mikrograf SEM Penampang Antarmuka Li-Garnet LLZO',
        content: 'Citra SEM perbesaran 5000x antarmuka logam Litium dan keramik LLZO.',
      },
    ],
  },
  {
    id: 'preset-05',
    originalName: '05_Optika_Kuantum_Interferometri.pdf',
    outputName: '05-optika-kuantum-interferometri.md',
    fileSizeBytes: 342_100,
    pageCount: 5,
    title: 'Bab 5: Interferometri Mach-Zehnder & Keadaan Terjerat (Entangled States)',
    category: 'Fisika Kuantum',
    rawTextLayer: `# Bab 5: Interferometri Mach-Zehnder & Keadaan Terjerat (Entangled States)

<!-- Halaman 1 -->

## 5.1 Keadaan Kuantum NOON dan Batas Heisenberg

Pada interferometer Mach-Zehnder dengan dua lengan optik $a$ dan $b$, keadaan foton terjerat maksimal (*NOON state*) dengan jumlah foton $N$ ditulis secara eksak dalam basis Fock:

$$|\\psi_{\\text{NOON}}\\rangle = \\frac{1}{\\sqrt{2}} \\left( |N, 0\\rangle_{a,b} + e^{i N \\phi} |0, N\\rangle_{a,b} \\right)$$

Ketidakpastian pengukuran pergeseran fase $\\Delta \\phi$ mencapai batas fundamental Heisenberg (*Heisenberg Limit*), meningkatkan resolusi sebesar faktor $\\sqrt{N}$ dibandingkan batas kuantum standar:

$$\\Delta \\phi_{\\text{HL}} = \\frac{1}{N} < \\Delta \\phi_{\\text{SQL}} = \\frac{1}{\\sqrt{N}}$$

### [Gambar Halaman 2] Pola Frinji Interferensi Multiphoton N=4

> **Transkripsi Visual Gambar 5.1:** Grafik kurva koinsidensi foton 4-detektor sebagai fungsi fase $\\phi \\in [0, 2\\pi]$. Kurva eksperimen menunjukkan 4 puncak interferensi penuh per periode $\\lambda$ dengan visibilitas $V = 96.4\\%$.`,
    visualElements: [
      {
        page: 1,
        type: 'equation',
        label: 'Keadaan Kuantum NOON & Batas Heisenberg',
        content: '$$|\\psi_{\\text{NOON}}\\rangle = \\frac{1}{\\sqrt{2}} \\left( |N, 0\\rangle_{a,b} + e^{i N \\phi} |0, N\\rangle_{a,b} \\right)$$',
      },
      {
        page: 2,
        type: 'figure',
        label: 'Pola Frinji Interferensi Multiphoton N=4',
        content: 'Grafik osilasi koinsidensi foton terhadap fase piezo-cermin.',
      },
    ],
  },
  {
    id: 'preset-06',
    originalName: '06_Optimasi_Konveks_Lagrangian.pdf',
    outputName: '06-optimasi-konveks-lagrangian.md',
    fileSizeBytes: 298_400,
    pageCount: 4,
    title: 'Bab 6: Dualitas Lagrange & Kondisi Karush-Kuhn-Tucker (KKT)',
    category: 'Matematika Terapan',
    rawTextLayer: `# Bab 6: Dualitas Lagrange & Kondisi Karush-Kuhn-Tucker (KKT)

<!-- Halaman 1 -->

## 6.1 Formulasi Masalah Primal dan Fungsi Lagrangian

Tinjau masalah optimasi konveks standar dengan variabel keputusan $x \\in \\mathbb{R}^n$:

$$\\min_{x \\in \\mathbb{R}^n} f_0(x) \\quad \\text{dengan kendala} \\quad f_i(x) \\le 0 \\; (i=1,\\dots,m), \\quad h_j(x) = 0 \\; (j=1,\\dots,p)$$

Fungsi Lagrangian $\\mathcal{L} : \\mathbb{R}^n \\times \\mathbb{R}^m \\times \\mathbb{R}^p \\rightarrow \\mathbb{R}$ dan syarat perlu-cukup optimalitas Karush-Kuhn-Tucker (KKT) pada titik pelana $(x^*, \\lambda^*, \\nu^*)$ adalah:

$$\\mathcal{L}(x, \\lambda, \\nu) = f_0(x) + \\sum_{i=1}^{m} \\lambda_i f_i(x) + \\sum_{j=1}^{p} \\nu_j h_j(x)$$

$$\\nabla_x \\mathcal{L}(x^*, \\lambda^*, \\nu^*) = \\nabla f_0(x^*) + \\sum_{i=1}^{m} \\lambda_i^* \\nabla f_i(x^*) + \\sum_{j=1}^{p} \\nu_j^* \\nabla h_j(x^*) = 0, \\quad \\lambda_i^* f_i(x^*) = 0$$

### [Gambar Halaman 2] Geometri Himpunan Feasible & Vektor Gradien KKT

> **Transkripsi Visual Gambar 6.1:** Diagram kontur 2D himpunan konveks $\\mathcal{F} = \\{x \\mid f_1(x) \\le 0, f_2(x) \\le 0\\}$. Pada titik optimal batas $x^*$, vektor $-\\nabla f_0(x^*)$ berada tepat di dalam kerucut konveks yang dibentuk oleh kombinasi linear non-negatif $\\lambda_1^* \\nabla f_1(x^*) + \\lambda_2^* \\nabla f_2(x^*)$.`,
    visualElements: [
      {
        page: 1,
        type: 'equation',
        label: 'Fungsi Lagrangian & Syarat Stasioneritas KKT',
        content: '$$\\mathcal{L}(x, \\lambda, \\nu) = f_0(x) + \\sum_{i=1}^{m} \\lambda_i f_i(x) + \\sum_{j=1}^{p} \\nu_j h_j(x)$$',
      },
      {
        page: 2,
        type: 'figure',
        label: 'Geometri Himpunan Feasible & Vektor Gradien KKT',
        content: 'Visualisasi kontur fungsi objektif dan kerucut normal gradien kendala.',
      },
    ],
  },
  {
    id: 'preset-07',
    originalName: '07_Pemrosesan_Sinyal_Wavelet_EEG.pdf',
    outputName: '07-pemrosesan-sinyal-wavelet-eeg.md',
    fileSizeBytes: 476_800,
    pageCount: 6,
    title: 'Bab 7: Transformasi Wavelet Kontinu untuk Dekomposisi Sinyal EEG',
    category: 'Rekayasa Biomedis',
    rawTextLayer: `# Bab 7: Transformasi Wavelet Kontinu untuk Dekomposisi Sinyal EEG

<!-- Halaman 1 -->

## 7.1 Dekomposisi Waktu-Frekuensi dengan Wavelet Morlet

Untuk sinyal non-stasioner elektroensefalografi $x(t) \\in L^2(\\mathbb{R})$, Transformasi Wavelet Kontinu (*Continuous Wavelet Transform*, CWT) terhadap parameter skala dilatasi $a > 0$ dan translasi waktu $b \\in \\mathbb{R}$ didefinisikan sebagai:

$$W_x(a, b) = \\frac{1}{\\sqrt{a}} \\int_{-\\infty}^{\\infty} x(t) \\, \\psi^*\\left(\\frac{t - b}{a}\\right) dt$$

dengan *mother wavelet* Morlet kompleks ternormalisasi:

$$\\psi(t) = \\pi^{-1/4} e^{i \\omega_0 t} e^{-t^2 / 2}, \\quad \\omega_0 = 6.0\\text{ rad/s}$$

### [Gambar Halaman 2] Skalogram Waktu-Frekuensi Aktivitas Korteks Motorik

> **Transkripsi Visual Gambar 7.1:** Peta kerapatan energi $|W_x(a,b)|^2$ pada kanal elektroda C3 dan C4 selama rentang $t \\in [0, 5.0]\\text{ detik}$. Terlihat desinkronisasi ritme mu ($10\\text{ Hz}$) pada $t = 1.2\\text{ dtk}$ diikuti lonjakan sinkronisasi beta ($22\\text{ Hz}$) pasca-gerakan.`,
    visualElements: [
      {
        page: 1,
        type: 'equation',
        label: 'Transformasi Wavelet Kontinu (CWT) & Wavelet Morlet',
        content: '$$W_x(a, b) = \\frac{1}{\\sqrt{a}} \\int_{-\\infty}^{\\infty} x(t) \\, \\psi^*\\left(\\frac{t - b}{a}\\right) dt$$',
      },
      {
        page: 2,
        type: 'figure',
        label: 'Skalogram Waktu-Frekuensi Aktivitas Korteks Motorik',
        content: 'Plot spektrum daya 2D waktu-frekuensi kanal EEG C3/C4.',
      },
    ],
  },
  {
    id: 'preset-08',
    originalName: '08_Mekanika_Orbital_Transfer_Hohmann.pdf',
    outputName: '08-mekanika-orbital-transfer-hohmann.md',
    fileSizeBytes: 364_500,
    pageCount: 5,
    title: 'Bab 8: Manuver Orbital & Efisiensi Bahan Bakar Transfer Hohmann',
    category: 'Teknik Dirgantara',
    rawTextLayer: `# Bab 8: Manuver Orbital & Efisiensi Bahan Bakar Transfer Hohmann

<!-- Halaman 1 -->

## 8.1 Persamaan Energi Spesifik Vis-Viva dan Perhitungan Impuls $\\Delta v$

Kecepatan orbital sesaat $v$ benda bermassa dapat diabaikan yang mengorbit benda pusat dengan parameter gravitasi standar $\\mu = GM$ pada jarak radial $r$ dan sumbu semi-mayor $a = (r_1 + r_2)/2$ memenuhi persamaan Vis-Viva:

$$v^2 = \\mu \\left( \\frac{2}{r} - \\frac{1}{a} \\right)$$

Impuls kecepatan pertama $\\Delta v_1$ pada periapsis $r_1$ dan impuls kedua $\\Delta v_2$ pada apoapsis $r_2$ untuk memasuki orbit lingkaran target adalah:

$$\\Delta v_1 = \\sqrt{\\frac{\\mu}{r_1}} \\left( \\sqrt{\\frac{2 r_2}{r_1 + r_2}} - 1 \\right), \\quad \\Delta v_2 = \\sqrt{\\frac{\\mu}{r_2}} \\left( 1 - \\sqrt{\\frac{2 r_1}{r_1 + r_2}} \\right)$$

### [Gambar Halaman 2] Diagram Lintasan Elips Transfer LEO ke GEO

> **Transkripsi Visual Gambar 8.1:** Skema geometri orbit koplanar: Orbit Parkir Rendah (LEO, $r_1 = 6.678\\text{ km}$, $v_1 = 7.73\\text{ km/s}$), pembakaran perigee $\\Delta v_1 = 2.46\\text{ km/s}$, lintasan transfer elips setengah periode $T_{\\text{transfer}} = 5\\text{ jam } 15\\text{ menit}$, dan pembakaran apogee $\\Delta v_2 = 1.48\\text{ km/s}$ menuju GEO ($r_2 = 42.164\\text{ km}$).`,
    visualElements: [
      {
        page: 1,
        type: 'equation',
        label: 'Persamaan Vis-Viva & Impuls Kecepatan Delta-v',
        content: '$$\\Delta v_1 = \\sqrt{\\frac{\\mu}{r_1}} \\left( \\sqrt{\\frac{2 r_2}{r_1 + r_2}} - 1 \\right)$$',
      },
      {
        page: 2,
        type: 'figure',
        label: 'Diagram Lintasan Elips Transfer LEO ke GEO',
        content: 'Ilustrasi geometri orbit bumi dari LEO (6.678 km) ke GEO (42.164 km).',
      },
    ],
  },
  {
    id: 'preset-09',
    originalName: '09_inferensi_bayesian_mcmc.pdf',
    outputName: '09-inferensi-bayesian-mcmc.md',
    fileSizeBytes: 410_200,
    pageCount: 6,
    title: 'Bab 9: Hamiltonian Monte Carlo (HMC) & Inferensi Posterior Bayesian',
    category: 'Statistika Komputasi',
    rawTextLayer: `# Bab 9: Hamiltonian Monte Carlo (HMC) & Inferensi Posterior Bayesian

<!-- Halaman 1 -->

## 9.1 Dinamika Fase Hamiltonian dan Integrator Simpektik Leapfrog

Untuk mengambil sampel dari distribusi posterior target $p(\\theta \\mid \\mathcal{D}) \\propto \\exp(-U(\\theta))$ dengan fungsi energi potensial $U(\\theta) = -\\log p(\\mathcal{D}, \\theta)$, Hamiltonian Monte Carlo memperkenalkan variabel momentum bantu $r \\sim \\mathcal{N}(0, M)$ sehingga fungsi Hamiltonian total berbunyi:

$$H(\\theta, r) = U(\\theta) + K(r) = -\\log p(\\mathcal{D}, \\theta) + \\frac{1}{2} r^T M^{-1} r$$

Lintasan fase $(\\theta(t), r(t))$ berevolusi mengikuti persamaan diferensial Hamilton:

$$\\frac{d\\theta_i}{dt} = \\frac{\\partial H}{\\partial r_i} = [M^{-1} r]_i, \\quad \\frac{dr_i}{dt} = -\\frac{\\partial H}{\\partial \\theta_i} = \\frac{\\partial \\log p(\\mathcal{D}, \\theta)}{\\partial \\theta_i}$$

| Algoritma Sampler | ESS / 1000 Gradien (D=50) | ESS / 1000 Gradien (D=500) | Tingkat Penerimaan (%) |
| :--- | ---: | ---: | ---: |
| Random-Walk Metropolis | 12.4 | 1.1 | 23.4 |
| Langevin (MALA) | 84.5 | 19.2 | 57.4 |
| **NUTS / HMC Simpektik** | **640.2** | **412.8** | **82.1** |`,
    visualElements: [
      {
        page: 1,
        type: 'equation',
        label: 'Fungsi Hamiltonian & Persamaan Gerak Fase',
        content: '$$H(\\theta, r) = -\\log p(\\mathcal{D}, \\theta) + \\frac{1}{2} r^T M^{-1} r$$',
      },
      {
        page: 1,
        type: 'table',
        label: 'Tabel Efisiensi Effective Sample Size (ESS)',
        content: '| Algoritma Sampler | ESS (D=50) | ESS (D=500) |\n| :--- | ---: | ---: |\n| NUTS / HMC Simpektik | 640.2 | 412.8 |',
      },
    ],
  },
  {
    id: 'preset-10',
    originalName: '10_Sistem_Terdistribusi_Konsensus_Raft.pdf',
    outputName: '10-sistem-terdistribusi-konsensus-raft.md',
    fileSizeBytes: 455_000,
    pageCount: 6,
    title: 'Bab 10: Replikasi State Machine & Jaminan Keamanan Konsensus Raft',
    category: 'Sistem Terdistribusi',
    rawTextLayer: `# Bab 10: Replikasi State Machine & Jaminan Keamanan Konsensus Raft

<!-- Halaman 1 -->

## 10.1 Syarat Kuorum Mayoritas dan Invarian Pencocokan Log (*Log Matching*)

Dalam klaster Raft yang terdiri atas $N = 2f + 1$ server, setiap keputusan pemilihan pemimpin (*Leader Election*) dan komitmen entri log memerlukan persetujuan kuorum mayoritas $Q$:

$$Q = \\left\\lfloor \\frac{N}{2} \\right\\rfloor + 1 = f + 1$$

Jika probabilitas kegagalan independen satu node adalah $p$, maka reliabilitas ketersediaan klaster $R_{\\text{klaster}}(p)$ memenuhi distribusi binomial kumulatif:

$$R_{\\text{klaster}}(p) = \\sum_{k=Q}^{N} \\binom{N}{k} (1 - p)^k p^{N - k}$$

### [Gambar Halaman 2] Diagram Transisi State Node (Follower, Candidate, Leader)

> **Transkripsi Visual Gambar 10.1:** Graf berarah transisi status server: *Follower* $\\xrightarrow{\\text{timeout pemilihan}}$ *Candidate* $\\xrightarrow{\\text{menerima suara mayoritas } Q}$ *Leader*. Jika *Candidate* atau *Leader* menerima pesan RPC \\\`AppendEntries\\\` atau \\\`RequestVote\\\` dengan nomor masa jabatan $T_{\\text{baru}} > T_{\\text{lokal}}$, node seketika kembali ke status *Follower*.`,
    visualElements: [
      {
        page: 1,
        type: 'equation',
        label: 'Syarat Kuorum Mayoritas & Reliabilitas Klaster',
        content: '$$Q = \\left\\lfloor \\frac{N}{2} \\right\\rfloor + 1, \\quad R_{\\text{klaster}}(p) = \\sum_{k=Q}^{N} \\binom{N}{k} (1 - p)^k p^{N - k}$$',
      },
      {
        page: 2,
        type: 'figure',
        label: 'Diagram Transisi State Node (Follower, Candidate, Leader)',
        content: 'Graf berarah transisi Follower, Candidate, dan Leader pada protokol Raft.',
      },
    ],
  },
];
