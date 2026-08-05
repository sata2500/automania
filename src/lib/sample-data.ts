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
    "name": "White CC1717",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/1785901566049-1654fb1b2716.webp",
    "folderId": "folder-1785843819101",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000,
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785847347645-3jwz",
    "name": "T-shirt_on_mannequin_different_a…_202608032015",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474292-652651.mp4",
    "folderId": "folder-1785843819101",
    "apparelType": "light",
    "printAreas": [],
    "opacity": 1,
    "width": 2000,
    "height": 2000,
    "hasPrintArea": false,
    "isVideo": true,
    "mimeType": "video/mp4"
  },
  {
    "id": "mockup-1785844010580-9f34",
    "name": "1717BohoFlatLayBlack",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474346-ecbb8b.png",
    "folderId": "folder-1785843819101",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000
  },
  {
    "id": "mockup-1785844013430-lvwn",
    "name": "1717BohoFlatLayIvory",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474362-bd4cfe.png",
    "folderId": "folder-1785843819101",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000,
    "hasPrintArea": true
  },
  {
    "id": "mockup-1785844016266-dmeo",
    "name": "1717BohoFlatLayPepper",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474374-253866.png",
    "folderId": "folder-1785843819101",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000
  },
  {
    "id": "mockup-1785844014355-vqo6",
    "name": "1717BohoFlatLayKhaki1",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474390-7c20e3.png",
    "folderId": "folder-1785843819101",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000
  },
  {
    "id": "mockup-1785844015334-uhma",
    "name": "1717BohoFlatLayMoss1",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474419-51ac70.png",
    "folderId": "folder-1785843819101",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000
  },
  {
    "id": "mockup-1785844012673-9odq",
    "name": "1717BohoFlatLayDemin",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474447-942b95.png",
    "folderId": "folder-1785843819101",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000
  },
  {
    "id": "mockup-1785844108876-huop",
    "name": "Man Comfort Colors 1717 Mockup (17)_result",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474473-b78869.png",
    "folderId": "folder-1785843819101",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 23.7,
        "y": 23.9,
        "width": 50.6,
        "height": 44.4,
        "rotation": 0
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 1800
  },
  {
    "id": "mockup-1785844105712-r57v",
    "name": "22_result",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474489-d336bb.png",
    "folderId": "folder-1785843819101",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 26.9,
        "y": 27.5,
        "width": 49.6,
        "height": 51.5,
        "rotation": -1
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 1800
  },
  {
    "id": "mockup-1785844108070-bx4c",
    "name": "Man Comfort Colors 1717 Mockup (15)_result",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474515-2d5be2.png",
    "folderId": "folder-1785843819101",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 23.2,
        "y": 42.2,
        "width": 55.3,
        "height": 50.6,
        "rotation": 0
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 1800
  },
  {
    "id": "mockup-1785844107218-gviq",
    "name": "Man Comfort Colors 1717 Mockup (7)_result",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474533-bcadf6.png",
    "folderId": "folder-1785843819101",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 22.9,
        "y": 35.1,
        "width": 59.3,
        "height": 55.8,
        "rotation": 1
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 1800
  },
  {
    "id": "mockup-1785844517673-50qk",
    "name": "Comfort Colors 1717 Size+Color",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474551-69443b.webp",
    "folderId": "folder-1785843819101",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 33,
        "y": 30,
        "width": 34,
        "height": 40,
        "rotation": 0
      }
    ],
    "opacity": 1,
    "width": 1600,
    "height": 1067,
    "hasPrintArea": false
  },
  {
    "id": "mockup-1785844410612-p87t",
    "name": "9.BellaCanvas3001 Black FlatLay Mockups",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474554-8a74e5.png",
    "folderId": "folder-1785843819101",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 24.3,
        "y": 27.8,
        "width": 46.6,
        "height": 45.6,
        "rotation": 0
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 1920
  },
  {
    "id": "mockup-1785844411430-1q3e",
    "name": "23.BellaCanvas3001 DustyBlue FlatLay Mockups",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474567-ac95de.png",
    "folderId": "folder-1785843819101",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 24.7,
        "y": 26.5,
        "width": 47.4,
        "height": 47.2,
        "rotation": 0
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 1920
  },
  {
    "id": "mockup-1785844517415-nj4h",
    "name": "bella canvas 3001 size and color chart_",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474584-9f4c7c.webp",
    "folderId": "folder-1785843819101",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 33,
        "y": 30,
        "width": 34,
        "height": 40,
        "rotation": 0
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 1600,
    "hasPrintArea": false
  },
  {
    "id": "mockup-1785844454741-0px4",
    "name": "Black-2",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474588-5aa74a.png",
    "folderId": "folder-1785843819101",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 28.5,
        "y": 18.8,
        "width": 44.2,
        "height": 53,
        "rotation": 0
      }
    ],
    "opacity": 1,
    "width": 1000,
    "height": 1250
  },
  {
    "id": "mockup-1785844454893-yvsp",
    "name": "Natural-2",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474597-5a46f8.png",
    "folderId": "folder-1785843819101",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 26.5,
        "y": 10.3,
        "width": 48.3,
        "height": 61.4,
        "rotation": 0
      }
    ],
    "opacity": 1,
    "width": 1000,
    "height": 1250
  },
  {
    "id": "mockup-1785844518135-iq1n",
    "name": "Printnest Youth",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474602-7f68bc.webp",
    "folderId": "folder-1785843819101",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 33,
        "y": 30,
        "width": 34,
        "height": 40,
        "rotation": 0
      }
    ],
    "opacity": 1,
    "width": 1697,
    "height": 2400,
    "hasPrintArea": false
  },
  {
    "id": "mockup-1785848097565-ozni",
    "name": "copy_C9EF0A07-F0E9-4A5F-ABE1-1190C4E662BA",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474604-ce6ea7.mp4",
    "folderId": "folder-1785843819101",
    "apparelType": "light",
    "printAreas": [],
    "opacity": 1,
    "width": 2000,
    "height": 2000,
    "hasPrintArea": false,
    "isVideo": true,
    "mimeType": "video/mp4"
  },
  {
    "id": "mockup-1785895264284-rez5",
    "name": "1717BohoFlatLayWhite",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474637-b5284d.png",
    "folderId": "folder-1785843837086",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785895446164-6bdy",
    "name": "T-shirt_on_mannequin_different_a…_202608032016",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474649-274f35.mp4",
    "folderId": "folder-1785843837086",
    "apparelType": "light",
    "printAreas": [],
    "opacity": 1,
    "width": 2000,
    "height": 2000,
    "hasPrintArea": false,
    "isVideo": true,
    "mimeType": "video/mp4"
  },
  {
    "id": "mockup-1785895258752-wzsc",
    "name": "1717BohoFlatLayBlack",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474664-9e2ed2.png",
    "folderId": "folder-1785843837086",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785895261244-68je",
    "name": "1717BohoFlatLayIvory",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474684-2bc947.png",
    "folderId": "folder-1785843837086",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785895263487-3zaq",
    "name": "1717BohoFlatLayPepper",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474697-7efabe.png",
    "folderId": "folder-1785843837086",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785895262137-22jt",
    "name": "1717BohoFlatLayKhaki1",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474720-cb525d.png",
    "folderId": "folder-1785843837086",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785895265682-qhqc",
    "name": "1717BohoFlatLayYam",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474750-040b82.png",
    "folderId": "folder-1785843837086",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785895259448-81h9",
    "name": "1717BohoFlatLayBlueSpruce",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474774-2b525a.png",
    "folderId": "folder-1785843837086",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785895260482-o5j0",
    "name": "1717BohoFlatLayDemin",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474793-03cefe.png",
    "folderId": "folder-1785843837086",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785895271184-oowj",
    "name": "Çalışma Yüzeyi 11",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474822-418ddb.png",
    "folderId": "folder-1785843837086",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 27.6,
        "y": 21.1,
        "width": 46.7,
        "height": 49,
        "rotation": -6
      }
    ],
    "opacity": 1,
    "width": 2161,
    "height": 2161,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785895276867-xbg9",
    "name": "PepperCC1717_1569",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474848-4e38d5.png",
    "folderId": "folder-1785843837086",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 38,
        "y": 25.6,
        "width": 39.7,
        "height": 48.1,
        "rotation": -1
      }
    ],
    "opacity": 1,
    "width": 1708,
    "height": 2400,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785895268083-7907",
    "name": "BlackCC1717_1694",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474866-572dfb.png",
    "folderId": "folder-1785843837086",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 29.9,
        "y": 24.8,
        "width": 45.2,
        "height": 53.5,
        "rotation": -1
      }
    ],
    "opacity": 1,
    "width": 1665,
    "height": 2400,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785895304694-d5qo",
    "name": "Comfort Colors 1717 Size+Color",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474880-5ae6cd.webp",
    "folderId": "folder-1785843837086",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 1600,
    "height": 1067,
    "hasPrintArea": false,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785896313119-cg3u",
    "name": "BC3001_FEMININE_VintageWhite",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474882-2de9e0.png",
    "folderId": "folder-1785843837086",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 28.8,
        "y": 25.8,
        "width": 47.5,
        "height": 42.9,
        "rotation": 0
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 1800,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785896312156-qma3",
    "name": "BC3001_FEMININE_VintageBlack",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474904-9db156.png",
    "folderId": "folder-1785843837086",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 28.8,
        "y": 25.8,
        "width": 47.5,
        "height": 42.9,
        "rotation": 0
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 1800,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785895304477-hupg",
    "name": "bella canvas 3001 size and color chart_",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474928-801125.webp",
    "folderId": "folder-1785843837086",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 1600,
    "hasPrintArea": false,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785896351479-yd73",
    "name": "White",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474935-851aa5.png",
    "folderId": "folder-1785843837086",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 28,
        "y": 18.3,
        "width": 45.6,
        "height": 54,
        "rotation": -1
      }
    ],
    "opacity": 1,
    "width": 1000,
    "height": 1250,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785896351292-mpkj",
    "name": "Black-2",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474940-1c9047.png",
    "folderId": "folder-1785843837086",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 28,
        "y": 18.3,
        "width": 45.6,
        "height": 54,
        "rotation": 0
      }
    ],
    "opacity": 1,
    "width": 1000,
    "height": 1250,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785895305046-27dt",
    "name": "Printnest Youth",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474951-df6b6c.webp",
    "folderId": "folder-1785843837086",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 1697,
    "height": 2400,
    "hasPrintArea": false,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785895371075-x6y5",
    "name": "copy_C9EF0A07-F0E9-4A5F-ABE1-1190C4E662BA",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474954-6701a4.mp4",
    "folderId": "folder-1785843837086",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1785895383962",
        "name": "Ana Baskı Alanı",
        "x": 33,
        "y": 30,
        "width": 34,
        "height": 40,
        "rotation": 0
      }
    ],
    "opacity": 1,
    "width": 2000,
    "height": 2000,
    "hasPrintArea": false,
    "isVideo": true,
    "mimeType": "video/mp4"
  },
  {
    "id": "mockup-1785897506992-awku",
    "name": "1717BohoFlatLayWhite",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474980-d338eb.png",
    "folderId": "folder-1785843860082",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785899770810-23li",
    "name": "T-shirt_on_mannequin_different_a…_202608050615",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903474991-bc1cf9.mp4",
    "folderId": "folder-1785843860082",
    "apparelType": "dark",
    "printAreas": [],
    "opacity": 1,
    "width": 2000,
    "height": 2000,
    "hasPrintArea": false,
    "isVideo": true,
    "mimeType": "video/mp4"
  },
  {
    "id": "mockup-1785897501545-vfs3",
    "name": "1717BohoFlatLayBlack",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475002-62d566.png",
    "folderId": "folder-1785843860082",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785897503257-wi2v",
    "name": "1717BohoFlatLayIvory",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475021-854f10.png",
    "folderId": "folder-1785843860082",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785897505050-gx0o",
    "name": "1717BohoFlatLayPepper",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475045-6cd66b.png",
    "folderId": "folder-1785843860082",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785897504150-aeed",
    "name": "1717BohoFlatLayMoss1",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475066-3fe148.png",
    "folderId": "folder-1785843860082",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785897502404-ebu5",
    "name": "1717BohoFlatLayDemin",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475092-7a1aa2.png",
    "folderId": "folder-1785843860082",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785897508002-wlrz",
    "name": "1717BohoFlatLayYam",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475118-612e2d.png",
    "folderId": "folder-1785843860082",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 2000,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785897513977-1khs",
    "name": "Çalışma Yüzeyi 11",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475145-7d572a.png",
    "folderId": "folder-1785843860082",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 27.6,
        "y": 21.1,
        "width": 46.7,
        "height": 49,
        "rotation": -6
      }
    ],
    "opacity": 1,
    "width": 2161,
    "height": 2161,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785897520670-ccax",
    "name": "PepperCC1717_1569",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475172-acc3a6.png",
    "folderId": "folder-1785843860082",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 38,
        "y": 25.6,
        "width": 39.7,
        "height": 48.1,
        "rotation": -1
      }
    ],
    "opacity": 1,
    "width": 1708,
    "height": 2400,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785897517478-ncpd",
    "name": "Man Comfort Colors 1717 Mockup (17)_result",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475196-700cbb.png",
    "folderId": "folder-1785843860082",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 23.7,
        "y": 23.9,
        "width": 50.6,
        "height": 44.4,
        "rotation": 0
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 1800,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785897518332-cuaz",
    "name": "Man Comfort Colors 1717 Mockup (21)_result",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475213-f60c37.png",
    "folderId": "folder-1785843860082",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 28.2,
        "y": 27.8,
        "width": 50.6,
        "height": 51.2,
        "rotation": -1
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 1800,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785897679298-ph3b",
    "name": "Comfort Colors 1717 Size+Color",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475237-3b08dc.webp",
    "folderId": "folder-1785843860082",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 1600,
    "height": 1067,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785897652466-djda",
    "name": "BC3001_FEMININE_VintageWhite",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475243-71e7d2.png",
    "folderId": "folder-1785843860082",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 28.8,
        "y": 25.8,
        "width": 47.5,
        "height": 42.9,
        "rotation": 0
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 1800,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785897651561-e2w2",
    "name": "BC3001_FEMININE_DarkGreyHeather",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475282-1ebe9b.png",
    "folderId": "folder-1785843860082",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 28.8,
        "y": 25.8,
        "width": 47.5,
        "height": 42.9,
        "rotation": 0
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 1800,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785897679113-4vh7",
    "name": "bella canvas 3001 size and color chart_",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475306-f3664a.webp",
    "folderId": "folder-1785843860082",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 2400,
    "height": 1600,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785897233765-6l8y",
    "name": "White",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475310-4e16cd.png",
    "folderId": "folder-1785843860082",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 28,
        "y": 18.3,
        "width": 45.6,
        "height": 54,
        "rotation": -1
      }
    ],
    "opacity": 1,
    "width": 1000,
    "height": 1250,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785897233594-8uhl",
    "name": "Dark Grey Heather-2",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475314-4e3530.png",
    "folderId": "folder-1785843860082",
    "apparelType": "dark",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 28,
        "y": 18.3,
        "width": 42.3,
        "height": 47.1,
        "rotation": 0
      }
    ],
    "opacity": 1,
    "width": 1000,
    "height": 1250,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785897679644-xyr1",
    "name": "Printnest Youth",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475330-c1246b.webp",
    "folderId": "folder-1785843860082",
    "apparelType": "light",
    "printAreas": [
      {
        "id": "area-1",
        "name": "Ana Baskı Alanı",
        "x": 20.8,
        "y": 32.8,
        "width": 62.3,
        "height": 54.2,
        "rotation": -7
      }
    ],
    "opacity": 1,
    "width": 1697,
    "height": 2400,
    "hasPrintArea": true,
    "isVideo": false,
    "mimeType": "image/webp"
  },
  {
    "id": "mockup-1785897755663-emyr",
    "name": "copy_C9EF0A07-F0E9-4A5F-ABE1-1190C4E662BA",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475333-58310f.mp4",
    "folderId": "folder-1785843860082",
    "apparelType": "light",
    "printAreas": [],
    "opacity": 1,
    "width": 2000,
    "height": 2000,
    "hasPrintArea": false,
    "isVideo": true,
    "mimeType": "video/mp4"
  }
];

export const SAMPLE_DESIGNS: DesignItem[] = [
  {
    "id": "design-1785848625527-il5s",
    "name": "Rabbit_in_lavender_and_daisies_202607301727light",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475366-694589.png",
    "targetApparel": "light",
    "isSelected": false,
    "width": 1500,
    "height": 1500
  },
  {
    "id": "design-1785848664295-nwmf",
    "name": "Rabbit_in_lavender_and_daisies_202607301727",
    "src": "https://t6kuamfgnlzdrbc4.public.blob.vercel-storage.com/sample-uploads/upload-clean-1785903475377-42669c.png",
    "targetApparel": "dark",
    "isSelected": false,
    "width": 1500,
    "height": 1500
  }
];

export const DEFAULT_PRESETS: MockupPreset[] = [
  {
    id: 'preset-standard-chest',
    title: 'Standart Göğüs Alanı (Düz)',
    apparelType: 'any',
    printArea: { x: 32.5, y: 30, width: 35, height: 42, rotation: 0 },
  },
  {
    id: 'preset-angled-15',
    title: 'Hafif Eğik / Açı (15° Sağa)',
    apparelType: 'any',
    printArea: { x: 32.5, y: 30, width: 35, height: 42, rotation: 15 },
  },
  {
    id: 'preset-angled-minus-15',
    title: 'Hafif Eğik / Açı (-15° Sola)',
    apparelType: 'any',
    printArea: { x: 32.5, y: 30, width: 35, height: 42, rotation: -15 },
  },
];
