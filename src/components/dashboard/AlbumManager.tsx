"use client";
import { useState, useEffect } from "react";
import {
  Folder,
  Plus,
  ArrowLeft,
  Image as ImageIcon,
  Upload,
  Search,
  X,
  Maximize2,
  Trash2,
  FolderOpen,
  Loader2,
  AlertCircle,
  Album,
} from "lucide-react";

export default function AlbumManager() {
  const [savedAlbums, setSavedAlbums] = useState<any[]>([]);
  const [activeAlbum, setActiveAlbum] = useState<any | null>(null);

  // State Data Foto & Upload
  const [photos, setPhotos] = useState<any[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCaption, setUploadCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // State Load More
  const [lastId, setLastId] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // State Modal & Search
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availableChannels, setAvailableChannels] = useState<any[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);

  useEffect(() => {
    fetchSavedAlbums();
  }, []);

  const fetchSavedAlbums = async () => {
    const res = await fetch("/api/telegram/albums");
    const data = await res.json();
    if (data.success) {
      setSavedAlbums(data.albums);
      setSelectedChannelIds(data.albums.map((a: any) => a.id));
    }
  };

  const openAlbum = async (album: any, isLoadMore = false) => {
    if (!isLoadMore) {
      setActiveAlbum(album);
      setIsLoadingPhotos(true);
      setPhotos([]); // Kosongkan grid untuk album baru
      setLastId(0);
      setHasMore(true);
    } else {
      setIsLoadingMore(true);
    }

    const offset = isLoadMore ? lastId : 0;

    try {
      const res = await fetch(
        `/api/telegram/album-media?id=${album.id}&offset=${offset}`,
      );
      const data = await res.json();

      if (data.success) {
        // 🔥 TAKTIK GANTIAN (SERIAL LOADING DENGAN JEDA)
        for (let i = 0; i < data.photos.length; i++) {
          const photo = data.photos[i];

          // 1. Masukkan foto ke dalam state photos
          setPhotos((prev) => [...prev, photo]);

          // 2. Berikan jeda waktu (misal 500ms - 1 detik) sebelum load foto berikutnya
          // Agar Telegram melihat ini sebagai aktivitas manusia yang sedang melihat-lihat
          await new Promise((resolve) => setTimeout(resolve, 800));
        }

        setLastId(data.lastId);
        if (data.photos.length < 8) setHasMore(false);
      }
    } catch (err) {
      console.error("Gagal muat foto:", err);
    } finally {
      setIsLoadingPhotos(false);
      setIsLoadingMore(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !activeAlbum) return;
    setIsUploading(true);

    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`;
    const finalCaption = uploadCaption.trim()
      ? `${uploadCaption} | ${dateStr} | show`
      : `${dateStr} | show`;

    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("targetChat", activeAlbum.id);
    formData.append("caption", finalCaption);

    try {
      const res = await fetch("/api/telegram/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setUploadFile(null);
        setUploadCaption("");
        openAlbum(activeAlbum);
      } else alert(data.error);
    } catch (err) {
      alert("Kesalahan jaringan");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSoftDelete = async (messageId: number, oldCaption: string) => {
    const isConfirm = confirm("Yakin ingin menghapus gambar ini dari Album?");
    if (!isConfirm) return;

    let newCaption = oldCaption
      ? oldCaption.replace(/show/g, "deleted")
      : "deleted";
    if (!newCaption.includes("deleted")) newCaption += " | deleted";

    try {
      const res = await fetch("/api/telegram/edit-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetChat: activeAlbum.id,
          messageId: messageId,
          newCaption: newCaption,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPhotos(photos.filter((p) => p.id !== messageId));
      } else alert("Gagal menghapus gambar.");
    } catch (error) {
      alert("Terjadi kesalahan sistem saat menghapus.");
    }
  };

  const openAddModal = async () => {
    setIsModalOpen(true);
    setSearchQuery("");
    setIsLoadingChannels(true);

    try {
      const res = await fetch("/api/telegram/channels");
      const data = await res.json();
      if (data.success) setAvailableChannels(data.channels);
    } catch (err) {
      alert("Gagal menarik data dari Telegram.");
    } finally {
      setIsLoadingChannels(false);
    }
  };

  const saveAlbums = async () => {
    const finalAlbums = availableChannels.filter((c) =>
      selectedChannelIds.includes(c.id),
    );
    await fetch("/api/telegram/albums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albums: finalAlbums }),
    });
    setSavedAlbums(finalAlbums);
    setIsModalOpen(false);
  };

  const filteredChannels = availableChannels.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // ===============================================
  // RENDER DALAM ALBUM (DETAIL VIEW)
  // ===============================================
  if (activeAlbum) {
    return (
      <div className="rounded-3xl bg-white p-8 border border-gray-100 shadow-sm min-h-[500px] relative">
        <button
          onClick={() => setActiveAlbum(null)}
          className="flex items-center gap-2 text-sm font-bold text-blue-600 mb-6 hover:text-blue-800 transition group"
        >
          <ArrowLeft
            size={16}
            className="group-hover:-translate-x-1 transition-transform"
          />
          Kembali ke Daftar Album
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shadow-inner">
            <ImageIcon size={24} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold">{activeAlbum.title}</h2>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-1">
              ID: {activeAlbum.id}
            </p>
          </div>
        </div>

        {/* Form Upload */}
        <form
          onSubmit={handleUpload}
          className="mb-10 flex flex-col md:flex-row gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 items-center shadow-sm"
        >
          <div className="flex-1 w-full relative">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
              required
            />
            <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-500">
              <Upload size={16} className="text-blue-600" />
              {uploadFile ? uploadFile.name : "Pilih foto..."}
            </div>
          </div>
          <input
            type="text"
            value={uploadCaption}
            onChange={(e) => setUploadCaption(e.target.value)}
            placeholder="Tulis caption (Opsional)..."
            className="w-full rounded-xl border border-gray-200 p-3 text-sm flex-1 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
          <button
            type="submit"
            disabled={isUploading || !uploadFile}
            className="w-full md:w-auto bg-blue-600 text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:bg-blue-300 transition shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <ImageIcon size={18} />
            )}
            {isUploading ? "MENGUPLOAD..." : "UPLOAD"}
          </button>
        </form>

        {isLoadingPhotos && photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 size={40} className="animate-spin text-blue-600 mb-4" />
            <p className="font-bold text-gray-400">
              Menarik media dari Telegram...
            </p>
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-3xl">
            <ImageIcon size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="font-bold text-gray-400">
              Belum ada foto di album ini.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {photos.map((p, index) => {
                const cleanCaption = p.caption
                  ? p.caption.replace(/(\s*\|\s*show\s*)/gi, "")
                  : "-";
                return (
                  <div
                    key={`container-${p.id}-${index}`} // Key unik agar React tidak bingung
                    className="rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 shadow-sm relative group aspect-square animate-in fade-in zoom-in duration-500"
                  >
                    <img
                      key={`img-${p.id}`}
                      src={p.url}
                      alt="Media"
                      loading="lazy"
                      // Fitur Anti-Glitch: Jika gagal load, browser akan coba refresh src sekali lagi
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (!target.src.includes("retry=1")) {
                          target.src = `${p.url}&retry=1`;
                        }
                      }}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />

                    <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                      <button
                        onClick={() => setFullscreenImage(p.url)}
                        className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 hover:text-white transition-all transform hover:scale-110"
                      >
                        <Maximize2 size={18} />
                      </button>
                      <button
                        onClick={() => handleSoftDelete(p.id, p.caption)}
                        className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 hover:text-white transition-all transform hover:scale-110"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12 text-white">
                      <p className="text-xs font-bold leading-relaxed truncate">
                        {cleanCaption || "-"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* --- TOMBOL LOAD MORE (PASTIKAN DILUAR GRID) --- */}
            <div className="w-full flex flex-col items-center justify-center mt-12 mb-6">
              {hasMore && photos.length > 0 ? (
                <button
                  onClick={() => openAlbum(activeAlbum, true)}
                  disabled={isLoadingMore}
                  className="flex items-center gap-3 bg-white border-2 border-blue-600 text-blue-600 px-12 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-xl shadow-blue-100 active:scale-95 disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <Loader2 size={24} className="animate-spin" />
                  ) : (
                    <Plus size={24} />
                  )}
                  {isLoadingMore ? "Menarik Data..." : "MUAT LEBIH BANYAK"}
                </button>
              ) : (
                photos.length > 0 && (
                  <div className="py-4 px-8 bg-gray-50 rounded-full border border-gray-100">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-[0.3em]">
                      Operasi Selesai - Semua Foto Dimuat
                    </p>
                  </div>
                )
              )}
            </div>{" "}
          </>
        )}

        {/* Modal Fullscreen */}
        {fullscreenImage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm animate-in fade-in duration-300">
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-6 right-6 w-12 h-12 bg-white/10 rounded-full text-white hover:bg-red-600 transition flex items-center justify-center"
            >
              <X size={24} />
            </button>
            <img
              src={fullscreenImage}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              alt="Fullscreen Media"
            />
          </div>
        )}
      </div>
    );
  }

  // ===============================================
  // RENDER AWAL (LIST VIEW ALBUM)
  // ===============================================
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center rounded-3xl bg-white p-6 border border-gray-100 shadow-sm">
        <div>
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            Album Tersimpan
          </h3>
          <p className="text-xs text-gray-500">
            Daftar channel yang dijadikan album foto.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition shadow-lg shadow-blue-100 flex items-center gap-2"
        >
          <Plus size={18} /> Tambah Album
        </button>
      </div>

      {savedAlbums.length === 0 ? (
        <div className="text-center py-24 bg-white border border-gray-100 shadow-sm rounded-3xl">
          <Album size={64} className="mx-auto text-gray-100 mb-4" />
          <p className="font-bold text-gray-400 uppercase tracking-widest text-xs">
            Belum ada album ditambahkan.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {savedAlbums.map((album) => (
            <div
              key={album.id}
              onClick={() => openAlbum(album)}
              className="group cursor-pointer rounded-3xl bg-white p-6 border border-gray-100 shadow-sm hover:border-blue-300 hover:shadow-xl hover:shadow-blue-50 transition-all flex items-center gap-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                <FolderOpen size={28} />
              </div>
              <div className="overflow-hidden">
                <h4 className="font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                  {album.title}
                </h4>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                  Ketuk untuk buka galeri
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Add Album */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <div>
                <h3 className="font-black text-xl tracking-tight">
                  Pilih Channel
                </h3>
                <p className="text-xs font-bold text-gray-400 uppercase">
                  Telegram Source
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-100 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-8 py-5 bg-white border-b border-gray-100">
              <div className="relative group">
                <Search
                  size={18}
                  className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-blue-600 transition-colors"
                />
                <input
                  type="text"
                  placeholder="Cari nama channel..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-2xl border border-gray-100 bg-gray-50 py-3.5 pl-11 pr-4 text-sm focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
              {isLoadingChannels ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2
                    size={40}
                    className="animate-spin text-blue-600 mb-4"
                  />
                  <p className="text-xs font-black text-blue-600 animate-pulse uppercase tracking-[0.2em]">
                    Menyedot channel...
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredChannels.map((c) => (
                    <label
                      key={c.id}
                      className="group flex items-center gap-4 p-4 rounded-2xl bg-white hover:bg-blue-50/50 cursor-pointer border border-gray-100 transition-all shadow-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedChannelIds.includes(c.id)}
                        onChange={() =>
                          setSelectedChannelIds((prev) =>
                            prev.includes(c.id)
                              ? prev.filter((id) => id !== c.id)
                              : [...prev, c.id],
                          )
                        }
                        className="w-6 h-6 rounded-lg border-gray-200 text-blue-600 cursor-pointer"
                      />
                      <div className="overflow-hidden">
                        <p className="font-bold text-sm text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                          {c.title}
                        </p>
                        <p className="text-[10px] font-black text-gray-400 truncate mt-0.5 opacity-70">
                          ID: {c.id}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="p-8 border-t border-gray-100 bg-white">
              <button
                onClick={saveAlbums}
                disabled={isLoadingChannels}
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-600 transition-all uppercase tracking-widest text-xs"
              >
                SIMPAN ALBUM TERPILIH
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
