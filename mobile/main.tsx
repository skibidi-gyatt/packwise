import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import Planner from '@/components/packing/Planner';
import { setFileExporter } from '@/lib/packing/files';
import '@/app/globals.css';
import './phone.css';
if (Capacitor.isNativePlatform())
  setFileExporter(async (name, text) => {
    const file = await Filesystem.writeFile({
      path: `exports/${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    try {
      await Share.share({ title: name, files: [file.uri] });
    } catch (e) {
      if (!/cancel/i.test(String((e as Error).message))) throw e;
    }
  });
createRoot(document.getElementById('root')!).render(<Planner phoneMode />);
