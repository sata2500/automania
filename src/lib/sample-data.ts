import { MockupItem, DesignItem, MockupFolder, MockupPreset } from '@/types/pod';

export const DEFAULT_FOLDERS: MockupFolder[] = [
  {
    "id": "folder-1785843819101",
    "name": "Erkek Tişörtleri",
    "isCustom": true
  },
  {
    "id": "folder-1785843837086",
    "name": "Kadın Tişörtleri",
    "isCustom": true
  },
  {
    "id": "folder-1785843860082",
    "name": "Unisex Tişörtler",
    "isCustom": true
  }
];

export const SAMPLE_MOCKUPS: MockupItem[] = [
  {
    "id": "mockup-1785844017057-9wjg",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352734670.webp",
    "name": "White CC1717",
    "width": 1500,
    "height": 1500,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "light",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785844010580-9f34",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352737417.webp",
    "name": "1717BohoFlatLayBlack",
    "width": 1500,
    "height": 1500,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "dark"
  },
  {
    "id": "mockup-1785844013430-lvwn",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352739784.webp",
    "name": "1717BohoFlatLayIvory",
    "width": 1500,
    "height": 1500,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "light",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785844016266-dmeo",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352742715.webp",
    "name": "1717BohoFlatLayPepper",
    "width": 1500,
    "height": 1500,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "dark"
  },
  {
    "id": "mockup-1785844014355-vqo6",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352746983.webp",
    "name": "1717BohoFlatLayKhaki1",
    "width": 1500,
    "height": 1500,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "light"
  },
  {
    "id": "mockup-1785844015334-uhma",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352750389.webp",
    "name": "1717BohoFlatLayMoss1",
    "width": 1500,
    "height": 1500,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "dark"
  },
  {
    "id": "mockup-1785844012673-9odq",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352753616.webp",
    "name": "1717BohoFlatLayDemin",
    "width": 1500,
    "height": 1500,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "dark"
  },
  {
    "id": "mockup-1785844108876-huop",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352756215.webp",
    "name": "Man Comfort Colors 1717 Mockup (17)_result",
    "width": 1500,
    "height": 1500,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "printAreas": [
      {
        "x": 23.7,
        "y": 23.9,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 50.6,
        "height": 44.4,
        "rotation": 0
      }
    ],
    "apparelType": "light"
  },
  {
    "id": "mockup-1785844105712-r57v",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352758503.webp",
    "name": "22_result",
    "width": 1500,
    "height": 1500,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "printAreas": [
      {
        "x": 26.9,
        "y": 27.5,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 49.6,
        "height": 51.5,
        "rotation": -1
      }
    ],
    "apparelType": "dark"
  },
  {
    "id": "mockup-1785844108070-bx4c",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352760474.webp",
    "name": "Man Comfort Colors 1717 Mockup (15)_result",
    "width": 1500,
    "height": 1500,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "printAreas": [
      {
        "x": 23.2,
        "y": 42.2,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 55.3,
        "height": 50.6,
        "rotation": 0
      }
    ],
    "apparelType": "dark"
  },
  {
    "id": "mockup-1785844107218-gviq",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352762174.webp",
    "name": "Man Comfort Colors 1717 Mockup (7)_result",
    "width": 1500,
    "height": 1500,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "printAreas": [
      {
        "x": 22.9,
        "y": 35.1,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 59.3,
        "height": 55.8,
        "rotation": 1
      }
    ],
    "apparelType": "dark"
  },
  {
    "id": "mockup-1785930180821-ause",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352764529.webp",
    "name": "Enhance_image_ultra-realistic_sq…_4K_202608051436",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": false
  },
  {
    "id": "mockup-1785844410612-p87t",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352766376.webp",
    "name": "9.BellaCanvas3001 Black FlatLay Mockups",
    "width": 1500,
    "height": 1500,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "printAreas": [
      {
        "x": 24.3,
        "y": 27.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 46.6,
        "height": 45.6,
        "rotation": 0
      }
    ],
    "apparelType": "dark"
  },
  {
    "id": "mockup-1786396876947-4h0n",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/upload-1786396883567.webp",
    "name": "5.BellaCanvas3001 Atlantic FlatLay Mockups.jfif",
    "width": 2000,
    "height": 1600,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 24.5,
        "y": 26.9,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 48.5,
        "height": 44.9,
        "rotation": -1
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785844411430-1q3e",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352768528.webp",
    "name": "23.BellaCanvas3001 DustyBlue FlatLay Mockups",
    "width": 1500,
    "height": 1500,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "printAreas": [
      {
        "x": 24.7,
        "y": 26.5,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 47.4,
        "height": 47.2,
        "rotation": 0
      }
    ],
    "apparelType": "light"
  },
  {
    "id": "mockup-1785930123208-3t5k",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352770264.webp",
    "name": "Enhance_image_ultra-realistic_sq…_4K_202608051437",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 33,
        "y": 30,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 34,
        "height": 40,
        "rotation": 0
      }
    ],
    "apparelType": "light",
    "hasPrintArea": false
  },
  {
    "id": "mockup-1785844454741-0px4",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352771695.webp",
    "name": "Black-2",
    "width": 1500,
    "height": 1500,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "printAreas": [
      {
        "x": 28.5,
        "y": 18.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 44.2,
        "height": 53,
        "rotation": 0
      }
    ],
    "apparelType": "dark"
  },
  {
    "id": "mockup-1786396980748-ys1p",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/upload-1786396991420.webp",
    "name": "Dark Grey Heather-2",
    "width": 1000,
    "height": 1250,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 27.3,
        "y": 17.3,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 43.7,
        "height": 45.7,
        "rotation": -1
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785844454893-yvsp",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352772633.webp",
    "name": "Natural-2",
    "width": 1500,
    "height": 1500,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "printAreas": [
      {
        "x": 26.5,
        "y": 10.3,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 48.3,
        "height": 61.4,
        "rotation": 0
      }
    ],
    "apparelType": "light"
  },
  {
    "id": "mockup-1785844518135-iq1n",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352773850.webp",
    "name": "Printnest Youth",
    "width": 1500,
    "height": 1500,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "printAreas": [
      {
        "x": 33,
        "y": 30,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 34,
        "height": 40,
        "rotation": 0
      }
    ],
    "apparelType": "light",
    "hasPrintArea": false
  },
  {
    "id": "mockup-1785895264284-rez5",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352775861.webp",
    "name": "1717BohoFlatLayWhite",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "light",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785895258752-wzsc",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352778095.webp",
    "name": "1717BohoFlatLayBlack",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785895261244-68je",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352779721.webp",
    "name": "1717BohoFlatLayIvory",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "light",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785895263487-3zaq",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352781825.webp",
    "name": "1717BohoFlatLayPepper",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785895262137-22jt",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352784587.webp",
    "name": "1717BohoFlatLayKhaki1",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "light",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785895265682-qhqc",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352787768.webp",
    "name": "1717BohoFlatLayYam",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785895259448-81h9",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352791045.webp",
    "name": "1717BohoFlatLayBlueSpruce",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785895260482-o5j0",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352794657.webp",
    "name": "1717BohoFlatLayDemin",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785895271184-oowj",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352798288.webp",
    "name": "Çalışma Yüzeyi 11",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 27.6,
        "y": 21.1,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 46.7,
        "height": 49,
        "rotation": -6
      }
    ],
    "apparelType": "light",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1786439528809-5tmz",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/upload-1786439567614.webp",
    "name": "BayCC1717_1688_",
    "width": 1429,
    "height": 2000,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 30.1,
        "y": 28.2,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 41,
        "height": 53.8,
        "rotation": 0
      }
    ],
    "apparelType": "light",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1786439530851-jn19",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/upload-1786439540666.webp",
    "name": "BerryCC1717_1704",
    "width": 1467,
    "height": 2000,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 30.1,
        "y": 26.6,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 41.6,
        "height": 52.9,
        "rotation": 2
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785895276867-xbg9",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352801452.webp",
    "name": "PepperCC1717_1569",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 38,
        "y": 25.6,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 39.7,
        "height": 48.1,
        "rotation": -1
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785895268083-7907",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352803555.webp",
    "name": "BlackCC1717_1694",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 29.9,
        "y": 24.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 45.2,
        "height": 53.5,
        "rotation": -1
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785930297903-r6tu",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352805690.webp",
    "name": "Enhance_image_ultra-realistic_sq…_4K_202608051436",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 33,
        "y": 30,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 34,
        "height": 40,
        "rotation": 0
      }
    ],
    "apparelType": "light",
    "hasPrintArea": false
  },
  {
    "id": "mockup-1785896313119-cg3u",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352808345.webp",
    "name": "BC3001_FEMININE_VintageWhite",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 28.8,
        "y": 25.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 47.5,
        "height": 42.9,
        "rotation": 0
      }
    ],
    "apparelType": "light",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785896312156-qma3",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352812186.webp",
    "name": "BC3001_FEMININE_VintageBlack",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 28.8,
        "y": 25.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 47.5,
        "height": 42.9,
        "rotation": 0
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785930296134-m4zl",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352814199.webp",
    "name": "Enhance_image_ultra-realistic_sq…_4K_202608051437",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 33,
        "y": 30,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 34,
        "height": 40,
        "rotation": 0
      }
    ],
    "apparelType": "light",
    "hasPrintArea": false
  },
  {
    "id": "mockup-1785896351479-yd73",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352815221.webp",
    "name": "White",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 28,
        "y": 18.3,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 45.6,
        "height": 54,
        "rotation": -1
      }
    ],
    "apparelType": "light",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785896351292-mpkj",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352816174.webp",
    "name": "Black-2",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 28,
        "y": 18.3,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 45.6,
        "height": 54,
        "rotation": 0
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785895305046-27dt",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352817048.webp",
    "name": "Printnest Youth",
    "width": 1414,
    "height": 2000,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "light",
    "hasPrintArea": false
  },
  {
    "id": "mockup-1785897506992-awku",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352818778.webp",
    "name": "1717BohoFlatLayWhite",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "light",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785897501545-vfs3",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352821771.webp",
    "name": "1717BohoFlatLayBlack",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785897503257-wi2v",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352823954.webp",
    "name": "1717BohoFlatLayIvory",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "light",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785897505050-gx0o",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352826873.webp",
    "name": "1717BohoFlatLayPepper",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785897504150-aeed",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352830219.webp",
    "name": "1717BohoFlatLayMoss1",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785897502404-ebu5",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352833211.webp",
    "name": "1717BohoFlatLayDemin",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785897508002-wlrz",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352836281.webp",
    "name": "1717BohoFlatLayYam",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785897513977-1khs",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352839936.webp",
    "name": "Çalışma Yüzeyi 11",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 27.6,
        "y": 21.1,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 46.7,
        "height": 49,
        "rotation": -6
      }
    ],
    "apparelType": "light",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1786439823047-c1ux",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/upload-1786439899400.webp",
    "name": "BayCC1717_1688_",
    "width": 1429,
    "height": 2000,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 29.4,
        "y": 25.4,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 42.7,
        "height": 52.8,
        "rotation": 0
      }
    ],
    "apparelType": "light",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785897520670-ccax",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352842490.webp",
    "name": "PepperCC1717_1569",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 38,
        "y": 25.6,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 39.7,
        "height": 48.1,
        "rotation": -1
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785897517478-ncpd",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352844493.webp",
    "name": "Man Comfort Colors 1717 Mockup (17)_result",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 23.7,
        "y": 23.9,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 50.6,
        "height": 44.4,
        "rotation": 0
      }
    ],
    "apparelType": "light",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1786439824886-j59z",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/upload-1786439837903.webp",
    "name": "Man Comfort Colors 1717 Mockup (14)_result",
    "width": 2000,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 26.9,
        "y": 32.2,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 43.6,
        "height": 51.7,
        "rotation": -1
      }
    ],
    "apparelType": "light",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785897518332-cuaz",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352846883.webp",
    "name": "Man Comfort Colors 1717 Mockup (21)_result",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 28.2,
        "y": 27.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 50.6,
        "height": 51.2,
        "rotation": -1
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785930254363-iggz",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352849592.webp",
    "name": "Enhance_image_ultra-realistic_sq…_4K_202608051436",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 33,
        "y": 30,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 34,
        "height": 40,
        "rotation": 0
      }
    ],
    "apparelType": "light",
    "hasPrintArea": false
  },
  {
    "id": "mockup-1785897652466-djda",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352853981.webp",
    "name": "BC3001_FEMININE_VintageWhite",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 28.8,
        "y": 25.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 47.5,
        "height": 42.9,
        "rotation": 0
      }
    ],
    "apparelType": "light",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785897651561-e2w2",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352857557.webp",
    "name": "BC3001_FEMININE_DarkGreyHeather",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 28.8,
        "y": 25.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 47.5,
        "height": 42.9,
        "rotation": 0
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785930252428-f2o7",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352861415.webp",
    "name": "Enhance_image_ultra-realistic_sq…_4K_202608051437",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 33,
        "y": 30,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 34,
        "height": 40,
        "rotation": 0
      }
    ],
    "apparelType": "light",
    "hasPrintArea": false
  },
  {
    "id": "mockup-1785897233765-6l8y",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352862672.webp",
    "name": "White",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 28,
        "y": 18.3,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 45.6,
        "height": 54,
        "rotation": -1
      }
    ],
    "apparelType": "light",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785897233594-8uhl",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352865092.webp",
    "name": "Dark Grey Heather-2",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 28,
        "y": 18.3,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 42.3,
        "height": 47.1,
        "rotation": 0
      }
    ],
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785897679644-xyr1",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/mockup-optimized-1786352866728.webp",
    "name": "Printnest Youth",
    "width": 1500,
    "height": 1500,
    "isVideo": false,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "image/webp",
    "printAreas": [
      {
        "x": 20.8,
        "y": 32.8,
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "apparelType": "light",
    "hasPrintArea": false
  },
  {
    "id": "mockup-1786439448963-8l35",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/upload-1786439444635.mp4",
    "name": "copy_C9EF0A07-F0E9-4A5F-ABE1-1190C4E662BA",
    "width": 2000,
    "height": 2000,
    "isVideo": true,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "mimeType": "webm",
    "printAreas": [],
    "apparelType": "light",
    "hasPrintArea": false
  },
  {
    "id": "mockup-1786439700537-i2zx",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/upload-1786439694912.mp4",
    "name": "copy_C9EF0A07-F0E9-4A5F-ABE1-1190C4E662BA",
    "width": 2000,
    "height": 2000,
    "isVideo": true,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "webm",
    "printAreas": [],
    "apparelType": "light",
    "hasPrintArea": false
  },
  {
    "id": "mockup-1786439976898-sa8j",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/upload-1786439972743.mp4",
    "name": "copy_C9EF0A07-F0E9-4A5F-ABE1-1190C4E662BA",
    "width": 2000,
    "height": 2000,
    "isVideo": true,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "webm",
    "printAreas": [],
    "apparelType": "light",
    "hasPrintArea": false
  }
];

export const SAMPLE_DESIGNS: DesignItem[] = [
  {
    "id": "design-1785848625527-il5s",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475366-694589.png",
    "name": "Rabbit_in_lavender_and_daisies_202607301727light",
    "width": 1500,
    "height": 1500,
    "analysis": {
      "keywords": [
        "grow through",
        "what you go through",
        "grow through quote",
        "inspirational tee",
        "mental health shirt",
        "positivity shirt",
        "motivational shirt",
        "bunny shirt",
        "rabbit t shirt",
        "lavender shirt",
        "daisy t-shirt",
        "floral bunny shirt",
        "botanical graphic",
        "cottagecore shirt",
        "cottagecore clothes",
        "nature lover gift",
        "bunny lover gift",
        "vintage bunny",
        "floral rabbit tee",
        "spring shirt",
        "easter bunny shirt",
        "wildflower shirt",
        "cute rabbit tee",
        "self care shirt",
        "mindfulness shirt"
      ],
      "analyzedAt": 1786357520896,
      "description": "This charming t-shirt design seamlessly blends the cottagecore aesthetic with inspirational messaging, featuring a hand-drawn white rabbit nestled among vibrant purple lavender sprigs and blooming white daisies. Below the soft botanical illustration, the typography reads 'GROW THROUGH what YOU GO THROUGH' in an elegant mix of serif and script fonts. Designed in a vintage-inspired watercolor and line art style, this piece appeals strongly to bunny owners, nature lovers, gardeners, and those passionate about mental health awareness and self-growth. It serves as a meaningful, trendy option for spring fashion, Easter apparel, and everyday positive mindset graphic tees on platforms like Etsy and Pinterest."
    },
    "isSelected": false,
    "targetApparel": "light"
  },
  {
    "id": "design-1785848664295-nwmf",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475377-42669c.png",
    "name": "Rabbit_in_lavender_and_daisies_202607301727",
    "width": 1500,
    "height": 1500,
    "isSelected": false,
    "targetApparel": "dark"
  },
  {
    "id": "design-1785928438775-f4cx",
    "seo": {
      "tags": [
        "250th anniversary",
        "semiquincentennial",
        "conservation shirt",
        "american wilderness",
        "retro nature shirt",
        "retro postcard tee",
        "1776 2026",
        "usa wilderness",
        "earthy nature tee",
        "outdoor gift",
        "wilderness gift",
        "hiking shirt",
        "eagle graphic shirt"
      ],
      "title": "250 Years American Wilderness Shirt, Semiquincentennial 1776-2026 Tee, Retro Postcard Hiking Graphic Shirt, National Parks Outdoor Gift",
      "description": "Celebrate 250 years of American freedom, conservation, and majestic natural heritage with this vintage postcard-style apparel. Featuring detailed line art of towering pine trees, river valleys, rugged mountain peaks, a classic camper, and a proud American Bald Eagle badge, this design honors the spirit of the US wilderness leading into the 2026 Semiquincentennial (1776-2026).\n\nRendered in warm, earthy tones of forest green, terracotta orange, and cozy beige, this piece is ideal for campers, hikers, national park travelers, conservationists, and anyone who loves the great outdoors.\n\n----------------------------------------\nGARMENT OPTIONS & HIGHLIGHTS\n----------------------------------------\n• Comfort Colors 1717:\n  - Premium 100% ring-spun cotton\n  - Garment-dyed for a soft-washed, vintage look and feel\n  - Relaxed unisex fit with durable double-needle stitching\n\n• Bella Canvas 3001:\n  - 100% combed and ring-spun lightweight cotton\n  - Super soft, tailored retail unisex fit\n  - Modern casual drape suitable for everyday wear\n\n• Youth Unisex Tee:\n  - Ultra-comfortable, lightweight cotton fit\n  - Durable print for young adventurers and outdoors lovers\n\n----------------------------------------\nSIZING & FIT\n----------------------------------------\n• Fits true to size for a standard unisex fit.\n• For an oversized retro streetwear style, we recommend sizing up 1-2 sizes.\n• Please consult our size chart in the listing photos prior to placing your order.\n\n----------------------------------------\nCARE INSTRUCTIONS\n----------------------------------------\n• Machine wash cold, inside out, with mild detergent and like colors.\n• Tumble dry low or line dry for maximum print longevity.\n• Do not iron directly on or over the graphic print.\n• Do not dry clean.\n\n----------------------------------------\nPROCESSING & SHIPPING\n----------------------------------------\n• Processing Time: 1 - 2 business days\n• Standard Shipping: 2 - 5 business days (US domestic delivery)\n\nThank you for supporting sustainable conservation and American outdoor freedom!",
      "generatedAt": 1786357701907
    },
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/upload-1785928433172.png",
    "name": "1000071181",
    "width": 2000,
    "height": 1493,
    "analysis": {
      "keywords": [
        "natures legacy",
        "250 years freedom",
        "1776 2026",
        "usa wilderness",
        "conservation shirt",
        "semiquincentennial",
        "250th anniversary",
        "retro nature shirt",
        "preservation freedom",
        "greetings from",
        "american wilderness",
        "250 years shirt",
        "conservation tee",
        "retro wilderness",
        "250th celebration",
        "earthy nature tee",
        "patriotic nature",
        "us conservation",
        "wilderness gift",
        "retro postcard tee",
        "eagle graphic shirt",
        "hiking shirt",
        "outdoor gift"
      ],
      "analyzedAt": 1786357538238,
      "description": "This vintage retro-style apparel design celebrates 250 years of American conservation and wilderness freedom leading up to the 2026 US Semiquincentennial (1776-2026). Styled like a classic distressed postcard, the artwork features detailed line drawings of majestic mountains, river valleys, giant pine trees, classic camper trailers, and a badge with the American Bald Eagle. With an earthy color scheme of forest green, terracotta orange, and warm beige, it appeals strongly to national park lovers, hikers, campers, conservationists, and patriotic outdoor enthusiasts looking to honor America's natural heritage."
    },
    "isSelected": true,
    "targetApparel": "both"
  }
];

export function isProtectedUrl(url: string): boolean {
  if (!url) return false;
  const inMockups = SAMPLE_MOCKUPS.some(m => m.src === url);
  if (inMockups) return true;
  const inDesigns = SAMPLE_DESIGNS.some(d => d.src === url);
  if (inDesigns) return true;
  return false;
}
