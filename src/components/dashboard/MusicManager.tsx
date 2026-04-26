"use client";
import { useState, useEffect } from "react";
import {
  Music,
  Disc,
  Search,
  Plus,
  X,
  ArrowLeft,
  Play,
  Trash2,
} from "lucide-react";

export default function MusicManager({ setPlayerState }: any) {
  const [savedMusicChannels, setSavedMusicChannels] = useState<any[]>([]);
  const [activeChannel, setActiveChannel] = useState<any | null>(null);
  const [songs, setSongs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // State Modal & Search
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availableChannels, setAvailableChannels] = useState<any[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchMusicChannels();
  }, []);
  const handlePlay = (index: number) => {
    setPlayerState({
      playlist: songs, // Kirim seluruh list lagu yang sudah di-load
      currentIndex: index, // Beritahu mulai dari lagu ke berapa
    });
  };
  const handleUploadMusic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !activeChannel) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("targetChat", activeChannel.id);

    try {
      const res = await fetch("/api/telegram/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setUploadFile(null);
        loadMusic(activeChannel); // Refresh list lagu
        alert("✅ Musik berhasil diunggah!");
      } else alert(data.error);
    } catch (err) {
      alert("Gagal upload.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteMusic = async (messageId: number, currentTitle: string) => {
    const isConfirm = confirm(`Hapus lagu "${currentTitle}" dari koleksi?`);
    if (!isConfirm) return;

    try {
      // Kita gunakan API edit-caption yang sudah ada, atau buat API edit-audio-title
      // Untuk musik, biasanya kita mengedit 'message' (caption) sebagai penanda deleted
      const res = await fetch("/api/telegram/edit-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetChat: activeChannel.id,
          messageId: messageId,
          newCaption: "deleted", // Kita beri tanda 'deleted' di caption pesan
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSongs(songs.filter((s) => s.id !== messageId));
        alert("Lagu berhasil dihapus (Soft Delete).");
      }
    } catch (err) {
      alert("Gagal menghapus lagu.");
    }
  };

  const fetchMusicChannels = async () => {
    const res = await fetch("/api/telegram/music-channels");
    const data = await res.json();
    if (data.success) {
      setSavedMusicChannels(data.channels);
      setSelectedIds(data.channels.map((c: any) => c.id));
    }
  };

  const openAddModal = async () => {
    setIsModalOpen(true);
    setIsLoadingList(true);
    try {
      const res = await fetch("/api/telegram/channels");
      const data = await res.json();
      if (data.success) setAvailableChannels(data.channels);
    } finally {
      setIsLoadingList(false);
    }
  };

  const saveMusicChannels = async () => {
    const final = availableChannels.filter((c) => selectedIds.includes(c.id));
    await fetch("/api/telegram/music-channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channels: final }),
    });
    setSavedMusicChannels(final);
    setIsModalOpen(false);
  };

  const loadMusic = async (channel: any) => {
    setActiveChannel(channel);
    setIsLoading(true);
    setSongs([]);
    try {
      const res = await fetch(`/api/telegram/album-music?id=${channel.id}`);
      const data = await res.json();
      if (data.success) setSongs(data.songs);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = availableChannels.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // VIEW MODE: MEMUTAR LAGU
  if (activeChannel) {
    return (
      <div className="rounded-3xl bg-white p-8 border border-gray-100 shadow-sm">
        <button
          onClick={() => setActiveChannel(null)}
          className="flex items-center gap-2 text-sm font-bold text-purple-600 mb-6"
        >
          <ArrowLeft size={16} /> Kembali
        </button>
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-200">
            <Disc
              size={28}
              className={isLoading ? "animate-spin" : "animate-spin-slow"}
            />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900">
              {activeChannel.title}
            </h2>
            <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">
              Koleksi Musik Cloud
            </p>
          </div>
        </div>
        {/* FORM UPLOAD MUSIK */}
        <div className="mb-10 bg-purple-50/50 p-6 rounded-3xl border border-purple-100 shadow-sm">
          <h4 className="text-sm font-black text-purple-900 mb-4 uppercase tracking-widest">
            Tambah Musik Baru
          </h4>
          <form
            onSubmit={handleUploadMusic}
            className="flex flex-col md:flex-row gap-4 items-center"
          >
            <div className="relative flex-1 w-full">
              <input
                type="file"
                accept=".mp3,.ogg,.flac,.m4a,.wav"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-700 transition cursor-pointer"
              />
            </div>
            <button
              type="submit"
              disabled={isUploading || !uploadFile}
              className="w-full md:w-auto bg-purple-600 text-white px-8 py-3 rounded-2xl text-sm font-bold shadow-lg shadow-purple-200 disabled:bg-gray-300 transition-all active:scale-95"
            >
              {isUploading ? "MENGUPLOAD..." : "UNGGAH LAGU"}
            </button>
          </form>
          <p className="mt-3 text-[10px] text-purple-400 font-bold italic">
            *Mendukung format MP3, OGG, FLAC, M4A
          </p>
        </div>

        {/* LIST LAGU (Sama seperti sebelumnya) */}

        {isLoading ? (
          <div className="py-20 text-center">
            <div className="h-10 w-10 animate-spin border-4 border-purple-100 border-t-purple-600 rounded-full mx-auto mb-4"></div>
            <p className="text-sm font-bold text-gray-400">
              Menarik file audio...
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {songs.map((song: any, index: number) => (
              <div
                key={song.id}
                className="group bg-white border border-gray-100 rounded-[1.5rem] p-5 shadow-sm hover:shadow-xl hover:border-purple-200 transition-all duration-300 flex flex-col justify-between relative"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMusic(song.id, song.title);
                  }}
                  className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur-sm text-gray-400 hover:text-red-600 rounded-xl opacity-0 group-hover:opacity-100 transition-all z-100 shadow-sm"
                >
                  <Trash2 size={16} />
                </button>

                {/* Bagian Atas: Visual & Info */}
                <div className="flex flex-col items-center">
                  <div className="w-full aspect-square bg-gray-50 rounded-[1.5rem] flex items-center justify-center text-purple-400 group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors duration-500 mb-4">
                    <Music size={48} strokeWidth={1.5} />
                  </div>

                  <div className="w-full text-center px-1">
                    <h4
                      className="text-sm font-bold text-gray-800 line-clamp-2 min-h-[40px] mb-1"
                      title={song.title}
                    >
                      {song.title}
                    </h4>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-1 rounded-md">
                      {song.size}
                    </span>
                  </div>
                </div>

                {/* Bagian Bawah: Tombol Play Tegas */}
                <div className="mt-5">
                  <button
                    onClick={() => handlePlay(index)}
                    className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white py-3.5 rounded-xl text-xs font-black uppercase tracking-tighter hover:bg-black hover:shadow-lg active:scale-95 transition-all"
                  >
                    <Play size={14} fill="currentColor" />
                    Play Music
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // LIST MODE: DAFTAR CHANNEL MUSIK
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center rounded-3xl bg-white p-6 border border-gray-100 shadow-sm">
        <div>
          <h3 className="font-bold text-gray-900">Koleksi Musik</h3>
          <p className="text-xs text-gray-500">
            Pilih channel untuk memutar lagu.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-purple-700 transition shadow-lg shadow-purple-100 flex items-center gap-2"
        >
          <Plus size={16} /> Tambah Channel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {savedMusicChannels.map((ch) => (
          <div
            key={ch.id}
            onClick={() => loadMusic(ch)}
            className="group cursor-pointer rounded-3xl bg-white p-6 border border-gray-100 shadow-sm hover:border-purple-300 hover:shadow-md transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl group-hover:rotate-12 transition-transform">
              <Music size={24} />
            </div>
            <div className="overflow-hidden">
              <h4 className="font-bold text-gray-900 truncate">{ch.title}</h4>
              <p className="text-xs text-gray-400">Klik untuk putar</p>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL SEARCH & ADD */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold">Cari Channel Musik</h3>
              <button onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="p-4 bg-white border-b">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-4 top-3 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Ketik nama channel..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-gray-100 bg-gray-50 py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30">
              {isLoadingList ? (
                <div className="py-10 text-center animate-pulse font-bold text-gray-400 italic">
                  Mencari di Telegram...
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100 hover:border-purple-200 cursor-pointer transition-all"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={() =>
                          setSelectedIds((prev) =>
                            prev.includes(c.id)
                              ? prev.filter((x) => x !== c.id)
                              : [...prev, c.id],
                          )
                        }
                        className="w-5 h-5 rounded text-purple-600"
                      />
                      <span className="font-bold text-sm text-gray-700 truncate">
                        {c.title}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 bg-white border-t">
              <button
                onClick={saveMusicChannels}
                className="w-full bg-purple-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-purple-700 transition"
              >
                SIMPAN CHANNEL MUSIK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
