import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 12;

export default function App() {
  const [files, setFiles] = useState([]);
  const [guestName, setGuestName] = useState("");
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const observer = useRef();

  const lastMediaRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
  };

  const uploadFiles = async () => {
    if (files.length === 0) return alert("Please select at least one file.");

    setUploading(true);

    for (const file of files) {
      const timestamp = Date.now();
      const filePath = `uploads/${timestamp}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("bakerweddingpics")
        .upload(filePath, file);

      if (uploadError) {
        alert(`Upload failed for ${file.name}`);
        continue;
      }

      const { error: insertError } = await supabase.from("media_metadata").insert([
        {
          file_path: filePath,
          guest_name: guestName || null,
          caption: caption || null,
        },
      ]);

      if (insertError) {
        alert(`Metadata insert failed for ${file.name}`);
        continue;
      }
    }

    setFiles([]);
    setGuestName("");
    setCaption("");
    setOffset(0);
    setMedia([]);
    setHasMore(true);
    await fetchMedia(0);
    setUploading(false);
  };

  const fetchMedia = async (offsetToUse) => {
    setLoadingMore(true);

    const { data: metadata, error } = await supabase
      .from("media_metadata")
      .select("file_path, guest_name, caption, created_at")
      .order("created_at", { ascending: false })
      .range(offsetToUse, offsetToUse + PAGE_SIZE - 1);

    if (error || !metadata) {
      setLoadingMore(false);
      return;
    }

    const urls = metadata.map((item) => {
      const { data } = supabase.storage.from("bakerweddingpics").getPublicUrl(item.file_path);
      return {
        ...item,
        public_url: data.publicUrl,
      };
    });

    if (offsetToUse === 0) {
      setMedia(urls);
    } else {
      setMedia((prev) => [...prev, ...urls]);
    }

    if (metadata.length < PAGE_SIZE) setHasMore(false);
    setOffset(offsetToUse + PAGE_SIZE);
    setLoadingMore(false);
  };

  useEffect(() => {
    fetchMedia(0);
  }, []);

  useEffect(() => {
    if (loadingMore || !hasMore) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        fetchMedia(offset);
      }
    });

    if (lastMediaRef.current) observer.current.observe(lastMediaRef.current);
  }, [loadingMore, hasMore, offset]);

  return (
    <div className="flex flex-col items-center text-center w-full">
      <img src="/s_r.png" className="max-w-[60%] sm:max-w-[30%] rotate-2" />
      <h1 className="text-3xl font-bold mb-6 text-center">Photo & Video Upload Portal</h1>

      <p className="max-w-[40%]">
        Thank you so much for celebrating with us! We would love it if you could share some of the special moments that we couldn't see ourselves.
        <br />
        <br />
        This application was designed by Ryan (with love ❤️) but is ultimately made for easy uploading. There is no login required to upload. Note that photos <span className="font-bold">cannot be deleted</span>, however, we (Ryan & Steph) can delete them ourselves later. Some video or image formats may not display correctly in the gallery, but if you see a placeholder image in the gallery, we have received it and will be able to view it later!
      </p>
      <br />
      <br />
      <span className="font-bold">This gallery will be closed one week after the wedding, so please upload your photos as soon as able.</span>

      <div className="mb-4 space-y-4 w-[60%]">
        <input
          type="file"
          accept="image/*,video/mp4,video/quicktime"
          multiple
          onChange={handleFileChange}
          className="block rounded border border-gray-300 p-2 w-[100%]"
        />

        <Input
          type="text"
          placeholder="Your name (optional)"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
        />

        <Input
          type="text"
          placeholder="Caption (optional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />

        <Button onClick={uploadFiles} disabled={uploading} className="w-full">
          {uploading ? "Uploading..." : "Upload"}
        </Button>
      </div>

      <hr className="my-8 w-[90%] border-t border-gray-300" />

      <h2 className="text-2xl font-semibold mb-6 text-center">Gallery</h2>

      {media.length === 0 ? (
        <p className="text-center italic text-gray-500">No media uploaded yet.</p>
      ) : (
        <div className="flex flex-wrap justify-center gap-4">
          {media.map((item, idx) => (
            <div key={idx} className="">
              <Card className="overflow-hidden">
                <CardHeader></CardHeader>
                <CardContent className="p-0">
                  {item.public_url.includes(".mp4") || item.public_url.includes("video") ? (
                    <video controls src={item.public_url} className="media-portrait" loading="lazy" />
                  ) : (
                    <img
                      src={item.public_url}
                      alt="guest upload"
                      className="media-portrait rounded-2xl"
                      onError={(e) => (e.target.src = "/fallback.png")}
                      loading="lazy"
                    />
                  )}
                </CardContent>
                <CardFooter className="flex flex-col items-center space-y-1">
                  <p className="text-sm font-semibold truncate w-full text-center min-w-0">
                    {item.guest_name || "Anonymous"}
                  </p>
                  <p className="text-xs italic truncate w-full text-center min-w-0">
                    {item.caption}
                  </p>
                  <Button>
                    <a
                      href={item.public_url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download
                    </a>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          ))}
          {hasMore && <div ref={lastMediaRef} className="h-8 w-full" />}
        </div>
      )}
    </div>
  );
}