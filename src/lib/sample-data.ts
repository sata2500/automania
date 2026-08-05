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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/1785901566049-1654fb1b2716.webp",
    "name": "White CC1717",
    "width": 2400,
    "height": 2000,
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
    "id": "mockup-1785931057389-vx17",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/T-shirt_on_mannequin_different_a%E2%80%A6_202606191429.mp4",
    "name": "T-shirt_on_mannequin_different_a…_202606191429",
    "width": 2000,
    "height": 2000,
    "isVideo": true,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "mimeType": "video/mp4",
    "printAreas": [],
    "apparelType": "light",
    "hasPrintArea": false
  },
  {
    "id": "mockup-1785844010580-9f34",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474346-ecbb8b.png",
    "name": "1717BohoFlatLayBlack",
    "width": 2400,
    "height": 2000,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474362-bd4cfe.png",
    "name": "1717BohoFlatLayIvory",
    "width": 2400,
    "height": 2000,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474374-253866.png",
    "name": "1717BohoFlatLayPepper",
    "width": 2400,
    "height": 2000,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474390-7c20e3.png",
    "name": "1717BohoFlatLayKhaki1",
    "width": 2400,
    "height": 2000,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474419-51ac70.png",
    "name": "1717BohoFlatLayMoss1",
    "width": 2400,
    "height": 2000,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474447-942b95.png",
    "name": "1717BohoFlatLayDemin",
    "width": 2400,
    "height": 2000,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474473-b78869.png",
    "name": "Man Comfort Colors 1717 Mockup (17)_result",
    "width": 2400,
    "height": 1800,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474489-d336bb.png",
    "name": "22_result",
    "width": 2400,
    "height": 1800,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474515-2d5be2.png",
    "name": "Man Comfort Colors 1717 Mockup (15)_result",
    "width": 2400,
    "height": 1800,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474533-bcadf6.png",
    "name": "Man Comfort Colors 1717 Mockup (7)_result",
    "width": 2400,
    "height": 1800,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/upload-1785930193791.webp",
    "name": "Enhance_image_ultra-realistic_sq…_4K_202608051436",
    "width": 1996,
    "height": 2000,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474554-8a74e5.png",
    "name": "9.BellaCanvas3001 Black FlatLay Mockups",
    "width": 2400,
    "height": 1920,
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
    "id": "mockup-1785844411430-1q3e",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474567-ac95de.png",
    "name": "23.BellaCanvas3001 DustyBlue FlatLay Mockups",
    "width": 2400,
    "height": 1920,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/upload-1785930204827.webp",
    "name": "Enhance_image_ultra-realistic_sq…_4K_202608051437",
    "width": 1996,
    "height": 2000,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474588-5aa74a.png",
    "name": "Black-2",
    "width": 1000,
    "height": 1250,
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
    "id": "mockup-1785844454893-yvsp",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474597-5a46f8.png",
    "name": "Natural-2",
    "width": 1000,
    "height": 1250,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/upload-1785929346467.webp",
    "name": "Printnest Youth",
    "width": 1697,
    "height": 2400,
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
    "id": "mockup-1785848097565-ozni",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474604-ce6ea7.mp4",
    "name": "copy_C9EF0A07-F0E9-4A5F-ABE1-1190C4E662BA",
    "width": 2000,
    "height": 2000,
    "isVideo": true,
    "opacity": 1,
    "folderId": "folder-1785843819101",
    "mimeType": "video/mp4",
    "printAreas": [],
    "apparelType": "light",
    "hasPrintArea": false
  },
  {
    "id": "mockup-1785895264284-rez5",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474637-b5284d.png",
    "name": "1717BohoFlatLayWhite",
    "width": 2400,
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
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785931201966-la36",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/T-shirt_on_mannequin_different_a%E2%80%A6_202608021732.mp4",
    "name": "T-shirt_on_mannequin_different_a…_202608021732",
    "width": 2000,
    "height": 2000,
    "isVideo": true,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "video/mp4",
    "printAreas": [],
    "apparelType": "light",
    "hasPrintArea": false
  },
  {
    "id": "mockup-1785895258752-wzsc",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474664-9e2ed2.png",
    "name": "1717BohoFlatLayBlack",
    "width": 2400,
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
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785895261244-68je",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474684-2bc947.png",
    "name": "1717BohoFlatLayIvory",
    "width": 2400,
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
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785895263487-3zaq",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474697-7efabe.png",
    "name": "1717BohoFlatLayPepper",
    "width": 2400,
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
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785895262137-22jt",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474720-cb525d.png",
    "name": "1717BohoFlatLayKhaki1",
    "width": 2400,
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
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785895265682-qhqc",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474750-040b82.png",
    "name": "1717BohoFlatLayYam",
    "width": 2400,
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
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785895259448-81h9",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474774-2b525a.png",
    "name": "1717BohoFlatLayBlueSpruce",
    "width": 2400,
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
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785895260482-o5j0",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474793-03cefe.png",
    "name": "1717BohoFlatLayDemin",
    "width": 2400,
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
    "apparelType": "dark",
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785895271184-oowj",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474822-418ddb.png",
    "name": "Çalışma Yüzeyi 11",
    "width": 2161,
    "height": 2161,
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
    "id": "mockup-1785895276867-xbg9",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474848-4e38d5.png",
    "name": "PepperCC1717_1569",
    "width": 1708,
    "height": 2400,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474866-572dfb.png",
    "name": "BlackCC1717_1694",
    "width": 1665,
    "height": 2400,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/upload-1785930326440.webp",
    "name": "Enhance_image_ultra-realistic_sq…_4K_202608051436",
    "width": 1996,
    "height": 2000,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474882-2de9e0.png",
    "name": "BC3001_FEMININE_VintageWhite",
    "width": 2400,
    "height": 1800,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474904-9db156.png",
    "name": "BC3001_FEMININE_VintageBlack",
    "width": 2400,
    "height": 1800,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/upload-1785930318913.webp",
    "name": "Enhance_image_ultra-realistic_sq…_4K_202608051437",
    "width": 1996,
    "height": 2000,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474935-851aa5.png",
    "name": "White",
    "width": 1000,
    "height": 1250,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474940-1c9047.png",
    "name": "Black-2",
    "width": 1000,
    "height": 1250,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474951-df6b6c.webp",
    "name": "Printnest Youth",
    "width": 1697,
    "height": 2400,
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
    "id": "mockup-1785895371075-x6y5",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474954-6701a4.mp4",
    "name": "copy_C9EF0A07-F0E9-4A5F-ABE1-1190C4E662BA",
    "width": 2000,
    "height": 2000,
    "isVideo": true,
    "opacity": 1,
    "folderId": "folder-1785843837086",
    "mimeType": "video/mp4",
    "printAreas": [
      {
        "x": 33,
        "y": 30,
        "id": "area-1785895383962",
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
    "id": "mockup-1785897506992-awku",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474980-d338eb.png",
    "name": "1717BohoFlatLayWhite",
    "width": 2400,
    "height": 2000,
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
    "id": "mockup-1785931651773-4xj7",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/T-shirt_on_mannequin_different_a%E2%80%A6_2026080217322.mp4",
    "name": "T-shirt_on_mannequin_different_a…_2026080217322",
    "width": 2000,
    "height": 2000,
    "isVideo": true,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "video/mp4",
    "printAreas": [],
    "apparelType": "light",
    "hasPrintArea": false
  },
  {
    "id": "mockup-1785897501545-vfs3",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475002-62d566.png",
    "name": "1717BohoFlatLayBlack",
    "width": 2400,
    "height": 2000,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475021-854f10.png",
    "name": "1717BohoFlatLayIvory",
    "width": 2400,
    "height": 2000,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475045-6cd66b.png",
    "name": "1717BohoFlatLayPepper",
    "width": 2400,
    "height": 2000,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475066-3fe148.png",
    "name": "1717BohoFlatLayMoss1",
    "width": 2400,
    "height": 2000,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475092-7a1aa2.png",
    "name": "1717BohoFlatLayDemin",
    "width": 2400,
    "height": 2000,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475118-612e2d.png",
    "name": "1717BohoFlatLayYam",
    "width": 2400,
    "height": 2000,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475145-7d572a.png",
    "name": "Çalışma Yüzeyi 11",
    "width": 2161,
    "height": 2161,
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
    "id": "mockup-1785897520670-ccax",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475172-acc3a6.png",
    "name": "PepperCC1717_1569",
    "width": 1708,
    "height": 2400,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475196-700cbb.png",
    "name": "Man Comfort Colors 1717 Mockup (17)_result",
    "width": 2400,
    "height": 1800,
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
    "id": "mockup-1785897518332-cuaz",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475213-f60c37.png",
    "name": "Man Comfort Colors 1717 Mockup (21)_result",
    "width": 2400,
    "height": 1800,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/upload-1785930419586.webp",
    "name": "Enhance_image_ultra-realistic_sq…_4K_202608051436",
    "width": 1996,
    "height": 2000,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475243-71e7d2.png",
    "name": "BC3001_FEMININE_VintageWhite",
    "width": 2400,
    "height": 1800,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475282-1ebe9b.png",
    "name": "BC3001_FEMININE_DarkGreyHeather",
    "width": 2400,
    "height": 1800,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/upload-1785930359082.webp",
    "name": "Enhance_image_ultra-realistic_sq…_4K_202608051437",
    "width": 1996,
    "height": 2000,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475310-4e16cd.png",
    "name": "White",
    "width": 1000,
    "height": 1250,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475314-4e3530.png",
    "name": "Dark Grey Heather-2",
    "width": 1000,
    "height": 1250,
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/upload-1785929489569.webp",
    "name": "Printnest Youth",
    "width": 1697,
    "height": 2400,
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
    "id": "mockup-1785897755663-emyr",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475333-58310f.mp4",
    "name": "copy_C9EF0A07-F0E9-4A5F-ABE1-1190C4E662BA",
    "width": 2000,
    "height": 2000,
    "isVideo": true,
    "opacity": 1,
    "folderId": "folder-1785843860082",
    "mimeType": "video/mp4",
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
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/upload-1785928433172.png",
    "name": "1000071181",
    "width": 2000,
    "height": 1493,
    "isSelected": true,
    "targetApparel": "both"
  }
];

export function isProtectedUrl(url: string): boolean {
  if (!url) return false;
  
  // Check if it's in sample mockups
  const inMockups = SAMPLE_MOCKUPS.some(m => m.src === url);
  if (inMockups) return true;
  
  // Check if it's in sample designs
  const inDesigns = SAMPLE_DESIGNS.some(d => d.src === url);
  if (inDesigns) return true;
  
  return false;
}
