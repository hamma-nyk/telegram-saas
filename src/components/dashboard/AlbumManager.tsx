"use client";
import { useState, useEffect, useRef } from "react";
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
  Play,
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
  const [fullscreenVideo, setFullscreenVideo] = useState<string | null>(null);

  // 🔥 SNIPER: Alat untuk membatalkan fetch secara spesifik dan aman
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchSavedAlbums();
  }, []);

  const fetchSavedAlbums = async () => {
    try {
      const res = await fetch("/api/telegram/albums");
      if (!res.ok) throw new Error("Gagal mengambil data album");
      const data = await res.json();
      if (data.success) {
        setSavedAlbums(data.albums);
        setSelectedChannelIds(data.albums.map((a: any) => a.id));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const openAlbum = async (album: any, isLoadMore = false) => {
    // 🔥 BATALKAN REQUEST LAMA: Jika ada request sebelumnya yang masih berjalan, tembak mati!
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Buat peluru (signal) baru untuk request yang akan dijalankan ini
    const newController = new AbortController();
    abortControllerRef.current = newController;

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
      // Gunakan relative path & sisipkan signal AbortController
      const res = await fetch(
        `/api/telegram/album-media?id=${album.id}&offset=${offset}`,
        { signal: newController.signal },
      );

      if (!res.ok) throw new Error("Gagal mengambil data media");

      const data = await res.json();

      if (data.success) {
        // 🔥 OPTIMIZED BATCH LOADING: Load semua sekaligus tanpa delay artificial
        // Backend sudah dioptimasi dengan connection pool dan caching
        setPhotos((prev) => {
          const newPhotos = data.photos.filter(
            (photo: any) => !prev.find((p) => p.id === photo.id)
          );
          return [...prev, ...newPhotos];
        });

        setLastId(data.lastId);
        setHasMore(data.hasMore);
      }

      // Matikan loading hanya jika sukses
      setIsLoadingPhotos(false);
      setIsLoadingMore(false);
    } catch (err: any) {
      // Abaikan jika error disebabkan oleh sengaja dibatalkan (AbortController)
      if (err.name === "AbortError") {
        console.log("Fetch dihentikan secara aman oleh sistem.");
      } else {
        console.error("Gagal muat foto:", err);
        // Matikan loading jika gagal karena error jaringan betulan
        setIsLoadingPhotos(false);
        setIsLoadingMore(false);
      }
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
      <div className="rounded-lg bg-card p-6 border border-border text-foreground min-h-[500px] relative">
        <button
          onClick={() => {
            // 🔥 Hentikan loading saat komandan menekan kembali
            if (abortControllerRef.current) {
              abortControllerRef.current.abort();
            }
            setActiveAlbum(null);
          }}
          className="flex items-center gap-2 text-sm font-medium mb-6 hover:opacity-80 transition group"
        >
          <ArrowLeft
            size={16}
            className="group-hover:-translate-x-1 transition-transform"
          />
          Kembali ke Daftar Album
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 bg-secondary rounded-md flex items-center justify-center text-secondary-foreground">
            <ImageIcon size={20} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{activeAlbum.title}</h2>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
              ID: {activeAlbum.id}
            </p>
          </div>
        </div>

        {/* Form Upload */}
        <form
          onSubmit={handleUpload}
          className="mb-10 flex flex-col md:flex-row gap-4 bg-background p-4 rounded-lg border border-border items-center"
        >
          <div className="flex-1 w-full relative">
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
              required
            />
            <div className="flex items-center gap-3 bg-background border border-input rounded-md px-3 py-2 text-sm text-muted-foreground">
              <Upload size={16} />
              {uploadFile ? uploadFile.name : "Pilih foto/video..."}
            </div>
          </div>
          <input
            type="text"
            value={uploadCaption}
            onChange={(e) => setUploadCaption(e.target.value)}
            placeholder="Tulis caption (Opsional)..."
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isUploading || !uploadFile}
            className="w-full md:w-auto bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ImageIcon size={16} />
            )}
            {isUploading ? "MENGUPLOAD..." : "UPLOAD"}
          </button>
        </form>

        {isLoadingPhotos && photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 size={32} className="animate-spin text-muted-foreground mb-4" />
            <p className="font-medium text-muted-foreground">
              Menarik media dari Telegram...
            </p>
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-lg">
            <ImageIcon size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
            <p className="font-medium text-muted-foreground">
              Belum ada foto di album ini.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {photos.map((p, index) => {
                const isVideo = p.type === "video";
                const cleanCaption = p.caption
                  ? p.caption.replace(/(\s*\|\s*show\s*)/gi, "")
                  : "-";
                return (
                  <div
                    key={`container-${p.id}-${index}`}
                    className="rounded-lg overflow-hidden bg-background border border-border relative group aspect-square animate-in fade-in zoom-in duration-500"
                  >
                    {isVideo ? (
                      <div className="relative w-full h-full bg-black">
                        <video
                          src={p.url}
                          className="w-full h-full object-cover opacity-60"
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white">
                            <Play size={24} fill="currentColor" />
                          </div>
                        </div>
                        <button
                          onClick={() => setFullscreenVideo(p.url)}
                          className="absolute inset-0 z-10"
                        />
                      </div>
                    ) : (
                      <img
                        key={`img-${p.id}`}
                        src={p.url}
                        alt="Media"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (!target.src.includes("retry=1")) {
                            target.src = `${p.url}&retry=1`;
                          }
                        }}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    )}

                    <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                      <button
                        onClick={() =>
                          isVideo
                            ? setFullscreenVideo(p.url)
                            : setFullscreenImage(p.url)
                        }
                        className="w-8 h-8 bg-background/90 backdrop-blur-sm rounded-md flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
                      >
                        <Maximize2 size={16} />
                      </button>
                      <button
                        onClick={() => handleSoftDelete(p.id, p.caption)}
                        className="w-8 h-8 bg-background/90 backdrop-blur-sm rounded-md flex items-center justify-center text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8 text-white pointer-events-none">
                      <p className="text-xs font-medium truncate">
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
                  className="flex items-center gap-2 bg-secondary text-secondary-foreground px-6 py-2 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  {isLoadingMore ? "Menarik Data..." : "MUAT LEBIH BANYAK"}
                </button>
              ) : (
                photos.length > 0 && (
                  <div className="py-2 px-4 bg-muted rounded-md">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Semua media dimuat
                    </p>
                  </div>
                )
              )}
            </div>{" "}
          </>
        )}

        {/* Modal Fullscreen Image */}
        {fullscreenImage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-secondary rounded-md text-secondary-foreground hover:opacity-80 transition flex items-center justify-center"
            >
              <X size={20} />
            </button>
            <img
              src={fullscreenImage}
              className="max-w-full max-h-[90vh] object-contain rounded-md"
              alt="Fullscreen Media"
            />
          </div>
        )}

        {/* Modal Fullscreen Video */}
        {fullscreenVideo && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <button
              onClick={() => setFullscreenVideo(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-secondary rounded-md text-secondary-foreground hover:opacity-80 transition flex items-center justify-center z-50"
            >
              <X size={20} />
            </button>
            <video
              src={fullscreenVideo}
              controls
              autoPlay
              className="max-w-full max-h-[90vh] rounded-md"
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
      <div className="flex justify-between items-center rounded-lg bg-card p-6 border border-border">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            Album Tersimpan
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Daftar channel yang dijadikan album foto.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition flex items-center gap-2"
        >
          <Plus size={16} /> Tambah Album
        </button>
      </div>

      {savedAlbums.length === 0 ? (
        <div className="text-center py-24 bg-card border border-border rounded-lg">
          <Album size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
          <p className="font-medium text-muted-foreground uppercase tracking-widest text-xs">
            Belum ada album ditambahkan.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {savedAlbums.map((album) => (
            <div
              key={album.id}
              onClick={() => openAlbum(album)}
              className="group cursor-pointer rounded-lg bg-card p-4 border border-border hover:bg-accent transition-colors flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-md bg-secondary text-secondary-foreground flex items-center justify-center">
                <FolderOpen size={24} />
              </div>
              <div className="overflow-hidden">
                <h4 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {album.title}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Ketuk untuk buka galeri
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Add Album */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-card rounded-lg border border-border shadow-lg overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-lg">Pilih Channel</h3>
                <p className="text-sm text-muted-foreground">Telegram Source</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
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
                  placeholder="Cari nama channel..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-muted/20">
              {isLoadingChannels ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2
                    size={32}
                    className="animate-spin text-muted-foreground mb-4"
                  />
                  <p className="text-sm font-medium text-muted-foreground">
                    Menyedot channel...
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredChannels.map((c) => (
                    <label
                      key={c.id}
                      className="group flex items-center gap-3 p-3 rounded-md bg-card hover:bg-accent cursor-pointer border border-border transition-colors"
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
                        className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
                      />
                      <div className="overflow-hidden">
                        <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
                          {c.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          ID: {c.id}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border bg-card">
              <button
                onClick={saveAlbums}
                disabled={isLoadingChannels}
                className="w-full bg-primary text-primary-foreground font-medium py-2 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
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
