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
  Upload,
  Loader2,
  Music2,
  AlertCircle,
} from "lucide-react";

export default function MusicManager({ setPlayerState }: any) {
  const [savedMusicChannels, setSavedMusicChannels] = useState<any[]>([]);
  const [activeChannel, setActiveChannel] = useState<any | null>(null);
  const [songs, setSongs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 🔥 STATE LOAD MORE
  const [lastId, setLastId] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

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

  const fetchMusicChannels = async () => {
    const res = await fetch("/api/telegram/music-channels");
    const data = await res.json();
    if (data.success) {
      setSavedMusicChannels(data.channels);
      setSelectedIds(data.channels.map((c: any) => c.id));
    }
  };

  const loadMusic = async (channel: any, isLoadMore = false) => {
    if (!isLoadMore) {
      setActiveChannel(channel);
      setIsLoading(true);
      setSongs([]);
      setLastId(0);
      setHasMore(true);
    } else {
      setIsLoadingMore(true);
    }

    const offset = isLoadMore ? lastId : 0;
    try {
      const res = await fetch(
        `/api/telegram/album-music?id=${channel.id}&offset=${offset}`,
      );
      const data = await res.json();

      if (data.success) {
        // 🔥 OPTIMIZED BATCH LOADING: Load semua sekaligus
        // Backend sudah menggunakan connection pool untuk performa maksimal
        setSongs((prev) => {
          const newSongs = data.songs.filter(
            (song: any) => !prev.find((s) => s.id === song.id)
          );
          return [...prev, ...newSongs];
        });

        setLastId(data.lastId);
        setHasMore(data.songs.length >= 20); // Sesuai dengan limit backend
      }
    } catch (err) {
      console.error("Gagal load music:", err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // ... (handlePlay, handleUploadMusic, handleDeleteMusic, openAddModal, saveMusicChannels tetap sama)
  const handlePlay = (index: number) => {
    setPlayerState({
      playlist: songs,
      currentIndex: index,
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
        loadMusic(activeChannel);
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
      const res = await fetch("/api/telegram/edit-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetChat: activeChannel.id,
          messageId: messageId,
          newCaption: "deleted",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSongs(songs.filter((s) => s.id !== messageId));
      }
    } catch (err) {
      alert("Gagal menghapus lagu.");
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

  const filtered = availableChannels.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (activeChannel) {
    return (
      <div className="rounded-[2.5rem] bg-white p-8 border border-gray-100 shadow-sm min-h-[500px]">
        <button
          onClick={() => setActiveChannel(null)}
          className="group flex items-center gap-2 text-sm font-bold text-purple-600 mb-6 hover:text-purple-800 transition-all"
        >
          <ArrowLeft
            size={16}
            className="group-hover:-translate-x-1 transition-transform"
          />{" "}
          Kembali ke Koleksi
        </button>

        <div className="flex items-center gap-5 mb-8">
          <div className="w-16 h-16 bg-purple-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-purple-100 relative overflow-hidden">
            <Disc
              size={32}
              className={`${isLoading ? "animate-spin" : "animate-spin-slow"}`}
            />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
              {activeChannel.title}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="flex h-2 w-2 rounded-full bg-purple-400 animate-pulse"></span>
              <p className="text-[10px] text-purple-400 uppercase font-black tracking-[0.2em]">
                Streaming Mode Active
              </p>
            </div>
          </div>
        </div>

        {/* Form Upload tetap sama */}
        <div className="mb-10 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
          <form
            onSubmit={handleUploadMusic}
            className="flex flex-col md:flex-row gap-4 items-center"
          >
            <div className="relative flex-1 w-full group">
              <input
                type="file"
                accept=".mp3,.ogg,.flac,.m4a,.wav"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
              />
              <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-sm text-slate-500 group-hover:border-purple-300 transition-all">
                <Upload size={18} className="text-purple-600" />
                <span className="truncate">
                  {uploadFile ? uploadFile.name : "Pilih file musik..."}
                </span>
              </div>
            </div>
            <button
              type="submit"
              disabled={isUploading || !uploadFile}
              className="w-full md:w-auto bg-purple-600 text-white px-10 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-100 disabled:bg-slate-200 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Music2 size={18} />
              )}
              {isUploading ? "MENGUPLOAD..." : "UNGGAH LAGU"}
            </button>
          </form>
        </div>

        {/* SONG LIST DENGAN LOAD MORE */}
        {isLoading && songs.length === 0 ? (
          <div className="py-24 text-center">
            <Loader2
              size={48}
              className="animate-spin text-purple-200 mx-auto mb-4"
            />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Menghubungkan ke Cloud...
            </p>
          </div>
        ) : songs.length === 0 ? (
          <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem]">
            <Music size={48} className="text-slate-100 mx-auto mb-4" />
            <p className="font-bold text-slate-300">
              Belum ada lagu di channel ini.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {songs.map((song: any, index: number) => (
                <div
                  key={song.id}
                  className="group bg-white border border-slate-100 rounded-[2rem] p-5 shadow-sm hover:shadow-2xl hover:shadow-purple-100 hover:border-purple-100 transition-all duration-500 flex flex-col justify-between relative overflow-hidden animate-in fade-in zoom-in duration-500"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteMusic(song.id, song.title);
                    }}
                    className="absolute top-4 right-4 p-2.5 bg-white/90 backdrop-blur-md text-slate-300 hover:text-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all z-20 shadow-sm border border-slate-100"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className="flex flex-col items-center relative">
                    <div className="w-full aspect-square bg-slate-50 rounded-[1.5rem] flex items-center justify-center text-slate-200 group-hover:bg-purple-600 group-hover:text-white transition-all duration-700 mb-5 shadow-inner">
                      <Music
                        size={48}
                        strokeWidth={1.5}
                        className="group-hover:scale-110 transition-transform"
                      />
                    </div>
                    <div className="w-full text-center px-1">
                      <h4 className="text-sm font-bold text-slate-800 line-clamp-2 min-h-[40px] mb-1 group-hover:text-purple-600 transition-colors">
                        {song.title}
                      </h4>
                      <div className="inline-block text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2.5 py-1 rounded-lg group-hover:bg-purple-50 group-hover:text-purple-400">
                        {song.size}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6">
                    <button
                      onClick={() => handlePlay(index)}
                      className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-600 shadow-xl shadow-slate-100 hover:shadow-purple-200 transition-all active:scale-95"
                    >
                      <Play size={14} fill="currentColor" /> Play Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {/* 🔥 TOMBOL LOAD MORE */}
            <div className="w-full flex flex-col items-center justify-center mt-12 mb-6">
              {hasMore && songs.length > 0 ? (
                <div className="flex justify-center py-12">
                  <button
                    onClick={() => loadMusic(activeChannel, true)}
                    disabled={isLoadingMore}
                    className="flex items-center gap-3 bg-white border-2 border-purple-600 text-purple-600 px-12 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-purple-600 hover:text-white transition-all shadow-xl shadow-purple-100 active:scale-95 disabled:opacity-50"
                  >
                    {isLoadingMore ? (
                      <Loader2 size={24} className="animate-spin" />
                    ) : (
                      <Plus size={24} />
                    )}
                    {isLoadingMore ? "Menarik Data..." : "MUAT LEBIH BANYAK"}
                  </button>
                </div>
              ) : (
                songs.length > 0 && (
                  <div className="py-4 px-8 bg-gray-50 rounded-full border border-gray-100">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-[0.3em]">
                      Operasi Selesai - Semua Musik Dimuat
                    </p>
                  </div>
                )
              )}
            </div>{" "}
          </>
        )}
      </div>
    );
  }

  // ... (LIST MODE: DAFTAR CHANNEL & MODAL tetap sama sesuai kode awal Anda)
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center rounded-[2.5rem] bg-white p-8 border border-gray-100 shadow-sm">
        <div>
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
            <Music2 size={24} className="text-purple-600" /> KOLEKSI MUSIK
          </h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            Cloud Streaming System
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="rounded-2xl bg-purple-600 px-6 py-3.5 text-xs font-black text-white hover:bg-slate-900 transition-all shadow-xl shadow-purple-100 flex items-center gap-2 uppercase tracking-widest"
        >
          <Plus size={18} /> Tambah Channel
        </button>
      </div>

      {savedMusicChannels.length === 0 ? (
        <div className="text-center py-24 bg-white border border-gray-100 shadow-sm rounded-[2.5rem]">
          <Disc size={64} className="mx-auto text-slate-50 mb-4" />
          <p className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">
            Belum ada koleksi musik.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {savedMusicChannels.map((ch) => (
            <div
              key={ch.id}
              onClick={() => loadMusic(ch)}
              className="group cursor-pointer rounded-[2.5rem] bg-white p-8 border border-gray-100 shadow-sm hover:border-purple-400 hover:shadow-2xl hover:shadow-purple-50 transition-all flex items-center gap-6"
            >
              <div className="w-16 h-16 rounded-[1.5rem] bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-inner">
                <Music size={32} />
              </div>
              <div className="overflow-hidden">
                <h4 className="text-lg font-bold text-slate-900 truncate group-hover:text-purple-600 transition-colors">
                  {ch.title}
                </h4>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  Buka Playlist Telegram
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL SEARCH & ADD */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-xl p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-black text-xl tracking-tight italic">
                  CARI CHANNEL
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Source Selector
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-500 transition-all shadow-sm"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 bg-white border-b border-slate-50">
              <div className="relative group">
                <Search
                  size={18}
                  className="absolute left-5 top-4 text-slate-300 group-focus-within:text-purple-600 transition-colors"
                />
                <input
                  type="text"
                  placeholder="Ketik nama channel..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-[1.5rem] border border-slate-100 bg-slate-50 py-4 pl-14 pr-6 text-sm focus:ring-4 focus:ring-purple-500/10 focus:border-purple-600 outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 custom-scrollbar">
              {isLoadingList ? (
                <div className="py-20 text-center">
                  <Loader2
                    size={40}
                    className="animate-spin text-purple-600 mx-auto mb-4"
                  />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">
                    Syncing with Telegram...
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                  <AlertCircle
                    size={48}
                    className="text-slate-100 mx-auto mb-4"
                  />
                  <p className="text-sm font-bold text-slate-300 italic">
                    Channel tidak ditemukan.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filtered.map((c) => (
                    <label
                      key={c.id}
                      className="group flex items-center gap-4 p-5 rounded-[1.5rem] bg-white border border-slate-100 hover:border-purple-200 cursor-pointer transition-all shadow-sm"
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
                        className="w-6 h-6 rounded-lg text-purple-600 border-slate-200 focus:ring-purple-500/20"
                      />
                      <span className="font-bold text-sm text-slate-700 truncate group-hover:text-purple-600">
                        {c.title}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="p-8 bg-white border-t border-slate-50">
              <button
                onClick={saveMusicChannels}
                className="w-full bg-slate-900 text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-slate-200 hover:bg-purple-600 hover:shadow-purple-200 transition-all active:scale-[0.98] text-[10px] uppercase tracking-[0.2em]"
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
