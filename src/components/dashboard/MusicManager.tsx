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
      <div className="rounded-lg bg-card p-6 border border-border min-h-[500px]">
        <button
          onClick={() => setActiveChannel(null)}
          className="group flex items-center gap-2 text-sm font-medium text-foreground mb-6 hover:opacity-80 transition-all"
        >
          <ArrowLeft
            size={16}
            className="group-hover:-translate-x-1 transition-transform"
          />{" "}
          Kembali ke Koleksi
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 bg-secondary rounded-md flex items-center justify-center text-secondary-foreground">
            <Disc
              size={20}
              className={`${isLoading ? "animate-spin" : ""}`}
            />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {activeChannel.title}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
              <p className="text-xs text-muted-foreground uppercase font-medium tracking-wider">
                Streaming Mode Active
              </p>
            </div>
          </div>
        </div>

        {/* Form Upload */}
        <div className="mb-10 bg-background p-4 rounded-lg border border-border">
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
              <div className="flex items-center gap-3 bg-background border border-input rounded-md px-3 py-2 text-sm text-muted-foreground">
                <Upload size={16} />
                <span className="truncate">
                  {uploadFile ? uploadFile.name : "Pilih file musik..."}
                </span>
              </div>
            </div>
            <button
              type="submit"
              disabled={isUploading || !uploadFile}
              className="w-full md:w-auto bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Music2 size={16} />
              )}
              {isUploading ? "MENGUPLOAD..." : "UNGGAH LAGU"}
            </button>
          </form>
        </div>

        {/* SONG LIST DENGAN LOAD MORE */}
        {isLoading && songs.length === 0 ? (
          <div className="py-24 text-center">
            <Loader2
              size={32}
              className="animate-spin text-muted-foreground mx-auto mb-4"
            />
            <p className="text-sm font-medium text-muted-foreground">
              Menghubungkan ke Cloud...
            </p>
          </div>
        ) : songs.length === 0 ? (
          <div className="py-24 text-center border-2 border-dashed border-border rounded-lg">
            <Music size={48} className="text-muted-foreground opacity-50 mx-auto mb-4" />
            <p className="font-medium text-muted-foreground">
              Belum ada lagu di channel ini.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {songs.map((song: any, index: number) => (
                <div
                  key={song.id}
                  className="group bg-card border border-border rounded-lg p-4 hover:bg-accent transition-colors flex flex-col justify-between relative overflow-hidden animate-in fade-in zoom-in duration-500"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteMusic(song.id, song.title);
                    }}
                    className="absolute top-2 right-2 p-2 bg-background/90 backdrop-blur-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-20 border border-border"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className="flex flex-col items-center relative">
                    <div className="w-full aspect-square bg-secondary rounded-md flex items-center justify-center text-secondary-foreground mb-4">
                      <Music
                        size={32}
                        strokeWidth={1.5}
                      />
                    </div>
                    <div className="w-full text-center px-1">
                      <h4 className="text-sm font-medium text-foreground line-clamp-2 min-h-[40px] mb-1">
                        {song.title}
                      </h4>
                      <div className="inline-block text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {song.size}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => handlePlay(index)}
                      className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 rounded-md text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      <Play size={14} fill="currentColor" /> Play
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {/* 🔥 TOMBOL LOAD MORE */}
            <div className="w-full flex flex-col items-center justify-center mt-8 mb-4">
              {hasMore && songs.length > 0 ? (
                <div className="flex justify-center py-8">
                  <button
                    onClick={() => loadMusic(activeChannel, true)}
                    disabled={isLoadingMore}
                    className="flex items-center gap-2 bg-secondary text-secondary-foreground px-6 py-2 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isLoadingMore ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Plus size={16} />
                    )}
                    {isLoadingMore ? "Menarik Data..." : "MUAT LEBIH BANYAK"}
                  </button>
                </div>
              ) : (
                songs.length > 0 && (
                  <div className="py-2 px-4 bg-muted rounded-md">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Semua Musik Dimuat
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
      <div className="flex justify-between items-center rounded-lg bg-card p-6 border border-border">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Music2 size={20} className="text-primary" /> Koleksi Musik
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Cloud Streaming System
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition flex items-center gap-2"
        >
          <Plus size={16} /> Tambah Channel
        </button>
      </div>

      {savedMusicChannels.length === 0 ? (
        <div className="text-center py-24 bg-card border border-border rounded-lg">
          <Disc size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
          <p className="text-sm font-medium text-muted-foreground">
            Belum ada koleksi musik.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {savedMusicChannels.map((ch) => (
            <div
              key={ch.id}
              onClick={() => loadMusic(ch)}
              className="group cursor-pointer rounded-lg bg-card p-4 border border-border hover:bg-accent transition-colors flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-md bg-secondary text-secondary-foreground flex items-center justify-center">
                <Music size={24} />
              </div>
              <div className="overflow-hidden">
                <h4 className="text-base font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {ch.title}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Buka Playlist Telegram
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL SEARCH & ADD */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-card rounded-lg border border-border shadow-lg overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-lg">
                  Cari Channel
                </h3>
                <p className="text-sm text-muted-foreground">
                  Source Selector
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 border-b border-border">
              <div className="relative group">
                <Search
                  size={16}
                  className="absolute left-3 top-3 text-muted-foreground"
                />
                <input
                  type="text"
                  placeholder="Ketik nama channel..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-muted/20 custom-scrollbar">
              {isLoadingList ? (
                <div className="py-20 text-center">
                  <Loader2
                    size={32}
                    className="animate-spin text-muted-foreground mx-auto mb-4"
                  />
                  <p className="text-sm font-medium text-muted-foreground">
                    Syncing with Telegram...
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                  <AlertCircle
                    size={32}
                    className="text-muted-foreground mx-auto mb-4 opacity-50"
                  />
                  <p className="text-sm font-medium text-muted-foreground">
                    Channel tidak ditemukan.
                  </p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {filtered.map((c) => (
                    <label
                      key={c.id}
                      className="group flex items-center gap-3 p-3 rounded-md bg-card border border-border hover:bg-accent cursor-pointer transition-colors"
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
                        className="w-4 h-4 rounded text-primary border-input focus:ring-primary"
                      />
                      <span className="font-medium text-sm text-foreground truncate group-hover:text-primary">
                        {c.title}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-card border-t border-border">
              <button
                onClick={saveMusicChannels}
                className="w-full bg-primary text-primary-foreground font-medium py-2 rounded-md hover:opacity-90 transition-opacity text-sm"
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
