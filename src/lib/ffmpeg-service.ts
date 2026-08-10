import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export const createFFmpegInstance = async (): Promise<FFmpeg> => {
  const ffmpeg = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  
  return ffmpeg;
};

export const getDurationWithFFmpeg = async (file: File): Promise<number> => {
  const ffmpeg = await createFFmpegInstance();
  
  const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '.mp4';
  const fileName = 'input_duration' + ext;
  await ffmpeg.writeFile(fileName, await fetchFile(file));
  
  return new Promise((resolve, reject) => {
    let duration = 0;
    
    const logHandler = ({ message }: { message: string }) => {
      if (message.includes('Duration:')) {
        const match = message.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d+)/);
        if (match) {
          const hours = parseFloat(match[1]);
          const minutes = parseFloat(match[2]);
          const seconds = parseFloat(match[3]);
          duration = hours * 3600 + minutes * 60 + seconds;
        }
      }
    };
    
    ffmpeg.on('log', logHandler);
    
    ffmpeg.exec(['-i', fileName]).then(async () => {
      ffmpeg.off('log', logHandler);
      try { ffmpeg.terminate(); } catch (e) {}
      if (duration > 0) resolve(duration);
      else reject(new Error("Duration could not be extracted via FFmpeg"));
    }).catch(async () => {
      // ffprobe/ffmpeg without output file throws an error by default but gives the metadata
      ffmpeg.off('log', logHandler);
      try { ffmpeg.terminate(); } catch (e) {}
      if (duration > 0) resolve(duration);
      else reject(new Error("Duration could not be extracted via FFmpeg"));
    });
  });
};

export const transcodeWithFFmpeg = async (file: File, onProgress?: (p: number) => void): Promise<File> => {
  const ffmpeg = await createFFmpegInstance();
  
  const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '.mp4';
  const inputName = 'input_transcode' + ext;
  const outputName = 'output.mp4';
  
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  
  let progressHandler: any;
  if (onProgress) {
    progressHandler = ({ progress }: { progress: number, time: number }) => {
      // progress is a float between 0 and 1
      onProgress(Math.round(progress * 100));
    };
    ffmpeg.on('progress', progressHandler);
  }
  
  let exitCode = -1;
  try {
    exitCode = await ffmpeg.exec([
      '-threads', '1',
      '-i', inputName,
      '-vf', 'scale=-2:720',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-r', '30',
      '-b:v', '2M',
      '-an',
      outputName
    ]);
  } finally {
    if (onProgress && progressHandler) {
      ffmpeg.off('progress', progressHandler);
    }
  }

  if (exitCode !== 0) {
    throw new Error(`FFmpeg işlemi başarısız oldu (Hata kodu: ${exitCode}). Video bozuk veya formatı geçersiz olabilir.`);
  }
  
  try {
    const data = await ffmpeg.readFile(outputName);
    
    // Clean up memory completely
    try {
      ffmpeg.terminate();
    } catch (e) {
      console.warn("FFmpeg file cleanup warning:", e);
    }

    // @ts-ignore
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    const finalName = file.name.includes('.') ? file.name.replace(/\.[^/.]+$/, "") + ".mp4" : "video.mp4";
    return new File([blob], finalName, { type: 'video/mp4' });
  } catch (err: any) {
    throw new Error(err.message || 'Dönüştürülen video dosyası okunamadı.');
  }
};
