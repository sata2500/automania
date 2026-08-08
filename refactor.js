const fs = require('fs');

const content = fs.readFileSync('d:/Projelerim/automania-next/src/components/seo/EtsySeoHelper.tsx', 'utf8');

const splitStartStudio = content.indexOf('{/* TAB 1: AI LISTING STUDIO */}');
const splitStartVariations = content.indexOf('{/* TAB 2: VIRTUAL VELA-STYLE VARIATION MATRIX EDITOR */}');
const splitStartPublish = content.indexOf('{/* TAB 3: ETSY STORE DIRECT PUBLISH */}');
const splitStartModals = content.indexOf('{/* Etsy Listings Modal */}');
const componentStart = content.indexOf('export const EtsySeoHelper');

const signatureEnd = content.indexOf('=> {', componentStart);
const hooksStart = signatureEnd + 4;

const returnMatch = content.match(/return\s*\(\s*<div className="space-y-6">/);
const returnStart = returnMatch.index;

const importsAndHelpers = content.substring(0, componentStart);
const hooksAndState = content.substring(hooksStart, returnStart);

const headerUI = content.substring(content.indexOf('<div className="space-y-6">', returnStart), splitStartStudio);
const studioUI = content.substring(splitStartStudio, splitStartVariations);
const variationsUI = content.substring(splitStartVariations, splitStartPublish);
const publishUI = content.substring(splitStartPublish, splitStartModals);
const modalsUI = content.substring(splitStartModals, content.lastIndexOf('</div>'));

const contextContent = [
  "'use client';",
  "import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';",
  "import { useToast } from '@/components/common/ToastContext';",
  "import { loadAppData, saveAppData } from '@/lib/storage-service';",
  "import { DesignItem, RenderedMatch } from '@/types/pod';",
  "",
  importsAndHelpers.substring(importsAndHelpers.indexOf('interface VariationRow')),
  "",
  "const EtsySeoContext = createContext<any>(null);",
  "",
  "export const EtsySeoProvider = ({ children, renderedMatches = [] }: { children: React.ReactNode, renderedMatches?: any[] }) => {",
  hooksAndState,
  `
  const contextValue = {
    activeTab, setActiveTab,
    userDesigns, setUserDesigns,
    selectedDesign, setSelectedDesign,
    sizes, setSizes,
    colors, setColors,
    variations, setVariations,
    basePrice, setBasePrice,
    niche, setNiche,
    productType, setProductType,
    designDescription, setDesignDescription,
    userNotes, setUserNotes,
    isGenerating, setIsGenerating,
    isSavingSettings, setIsSavingSettings,
    copiedKey, setCopiedKey,
    generatedTitle, setGeneratedTitle,
    generatedDescription, setGeneratedDescription,
    selectedTags, setSelectedTags,
    dbGeneratedMockups, setDbGeneratedMockups,
    allDesigns, setAllDesigns,
    selectedFolderId, setSelectedFolderId,
    combineAllDesigns, setCombineAllDesigns,
    folderOrder, setFolderOrder,
    editingFolderId, setEditingFolderId,
    editingFolderName, setEditingFolderName,
    deletingFolderId, setDeletingFolderId,
    draggedFolderId, setDraggedFolderId,
    foldersWithMockups,
    handleSelectFolder, handleRenameFolder, handleDeleteMockup, handleDeleteFolder,
    handleFolderDragStart, handleFolderDragOver, handleFolderDrop,
    handleSaveEtsySettings,
    statusFilter, setStatusFilter,
    colorFilter, setColorFilter,
    sizeFilter, setSizeFilter,
    genProduct, setGenProduct,
    genSizes, setGenSizes,
    genColors, setGenColors,
    genPrice, setGenPrice,
    genQuantity, setGenQuantity,
    newGenSizeInput, setNewGenSizeInput,
    newGenColorInput, setNewGenColorInput,
    savedCustomSizes, setSavedCustomSizes,
    savedCustomColors, setSavedCustomColors,
    handleAddCustomSize, handleDeleteCustomSize,
    handleAddCustomColor, handleDeleteCustomColor,
    defaultSizes, defaultColors,
    uniqueTableSizes, uniqueTableColors,
    handleGenerateToTable,
    dragState, setDragState,
    isPublishing, setIsPublishing,
    publishResult, setPublishResult,
    etsyConnected, setEtsyConnected,
    shippingProfiles, setShippingProfiles,
    selectedShippingProfileId, setSelectedShippingProfileId,
    readinessStates, setReadinessStates,
    selectedReadinessStateId, setSelectedReadinessStateId,
    copyToClipboard, handleGenerateAI,
    showListingsModal, setShowListingsModal,
    etsyListings, setEtsyListings,
    isFetchingListings, setIsFetchingListings,
    isFetchingInventory, setIsFetchingInventory,
    isSavingTemplate, setIsSavingTemplate,
    isSaveTemplateModalOpen, setIsSaveTemplateModalOpen,
    templateSaveName, setTemplateSaveName,
    isLoadTemplateModalOpen, setIsLoadTemplateModalOpen,
    savedTemplates, setSavedTemplates,
    isBulkSyncModalOpen, setIsBulkSyncModalOpen,
    selectedListingsForSync, setSelectedListingsForSync,
    isSyncing, setIsSyncing,
    selectedTemplateForSync, setSelectedTemplateForSync,
    handleOpenBulkSync, handleBulkSync, handleSaveCurrentTemplate,
    openLoadTemplateModal, handleLoadTemplate, handleDeleteTemplate,
    handleFetchListings, handleSelectListingTemplate,
    filteredVariations, handleDragStart, handleDragEnter,
    handlePublishToEtsy
  };

  return (
    <EtsySeoContext.Provider value={contextValue}>
      {children}
    </EtsySeoContext.Provider>
  );
};

export const useEtsySeo = () => {
  const context = useContext(EtsySeoContext);
  if (!context) {
    throw new Error('useEtsySeo must be used within an EtsySeoProvider');
  }
  return context;
};
`
].join('\n');

const uiImports = `import React from 'react';
import { Tag, Copy, Sparkles, Check, FileText, ShoppingBag, Layers, DollarSign, Send, RefreshCw, AlertTriangle, CheckCircle, Image as ImageIcon, ChevronRight, MousePointerClick, Filter, X, Folder, Edit2, Trash2, GripVertical } from 'lucide-react';
import { useEtsySeo } from '../context/EtsySeoContext';
`;

function cleanTabUI(uiStr) {
  // Remove wrapping "{activeTab === 'studio' && (" and matching ")}"
  let cleaned = uiStr.replace(/\{activeTab === '\w+' && \(\s*/g, '');
  cleaned = cleaned.replace(/\s*\)\}\s*$/g, '');
  // Because they might start with just a bare { in the file due to my splits
  cleaned = cleaned.replace(/^\s*\{\s*/, '');
  return cleaned;
}

const studioFile = [
  "'use client';",
  uiImports,
  "export const AIListingStudio = () => {",
  "  const {",
  "    activeTab,",
  "    foldersWithMockups,",
  "    selectedFolderId,",
  "    dbGeneratedMockups,",
  "    handleFolderDragStart, handleFolderDragOver, handleFolderDrop, handleSelectFolder,",
  "    editingFolderId, editingFolderName, setEditingFolderName, handleRenameFolder, setEditingFolderId,",
  "    deletingFolderId, handleDeleteFolder, setDeletingFolderId, draggedFolderId,",
  "    handleDeleteMockup, niche, setNiche, productType, setProductType,",
  "    userNotes, setUserNotes, isSavingSettings, handleSaveEtsySettings,",
  "    generatedTitle, setGeneratedTitle, copyToClipboard, copiedKey,",
  "    generatedDescription, setGeneratedDescription, selectedTags, setSelectedTags",
  "  } = useEtsySeo();",
  "",
  "  if (activeTab !== 'studio') return null;",
  "",
  "  return (",
  "    <>",
  cleanTabUI(studioUI),
  "    </>",
  "  );",
  "};"
].join('\n');

const variationsFile = [
  "'use client';",
  uiImports,
  "export const VariationMatrix = () => {",
  "  const {",
  "    activeTab,",
  "    openLoadTemplateModal, setIsSaveTemplateModalOpen, isSavingTemplate,",
  "    handleFetchListings, isFetchingListings, isFetchingInventory,",
  "    handleOpenBulkSync, genProduct, setGenProduct, genSizes, defaultSizes,",
  "    setGenSizes, savedCustomSizes, handleDeleteCustomSize, newGenSizeInput,",
  "    setNewGenSizeInput, handleAddCustomSize, genColors, defaultColors,",
  "    setGenColors, savedCustomColors, handleDeleteCustomColor, newGenColorInput,",
  "    setNewGenColorInput, handleAddCustomColor, genPrice, setGenPrice,",
  "    genQuantity, setGenQuantity, handleGenerateToTable, variations,",
  "    filteredVariations, statusFilter, setStatusFilter, colorFilter, setColorFilter,",
  "    uniqueTableColors, sizeFilter, setSizeFilter, uniqueTableSizes,",
  "    dragState, handleDragEnter, handleDragStart, setVariations,",
  "    showListingsModal, setShowListingsModal, etsyListings, handleSelectListingTemplate,",
  "    isSaveTemplateModalOpen, templateSaveName, setTemplateSaveName, handleSaveCurrentTemplate,",
  "    isLoadTemplateModalOpen, setIsLoadTemplateModalOpen, savedTemplates, handleDeleteTemplate, handleLoadTemplate,",
  "    isBulkSyncModalOpen, setIsBulkSyncModalOpen, selectedTemplateForSync, setSelectedTemplateForSync,",
  "    selectedListingsForSync, setSelectedListingsForSync, isSyncing, handleBulkSync",
  "  } = useEtsySeo();",
  "",
  "  if (activeTab !== 'variations') return null;",
  "",
  "  return (",
  "    <>",
  cleanTabUI(variationsUI),
  modalsUI,
  "    </>",
  "  );",
  "};"
].join('\n');

const publishFile = [
  "'use client';",
  uiImports,
  "export const EtsyPublisher = () => {",
  "  const {",
  "    activeTab, etsyConnected, selectedShippingProfileId, setSelectedShippingProfileId,",
  "    shippingProfiles, selectedReadinessStateId, setSelectedReadinessStateId,",
  "    readinessStates, isPublishing, handlePublishToEtsy, publishResult,",
  "    generatedTitle, generatedDescription, selectedTags, basePrice, variations,",
  "    dbGeneratedMockups, selectedFolderId",
  "  } = useEtsySeo();",
  "",
  "  if (activeTab !== 'publish') return null;",
  "",
  "  return (",
  "    <>",
  cleanTabUI(publishUI),
  "    </>",
  "  );",
  "};"
].join('\n');

const mainFile = [
  "'use client';",
  "import React from 'react';",
  "import { Sparkles, FileText, Layers, Send } from 'lucide-react';",
  "import { EtsySeoProvider, useEtsySeo } from './context/EtsySeoContext';",
  "import { AIListingStudio } from './tabs/AIListingStudio';",
  "import { VariationMatrix } from './tabs/VariationMatrix';",
  "import { EtsyPublisher } from './tabs/EtsyPublisher';",
  "",
  "const EtsySeoContent = () => {",
  "  const { activeTab, setActiveTab, isGenerating, handleGenerateAI, variations } = useEtsySeo();",
  "",
  "  return (",
  "    <div className=\"space-y-6\">",
  headerUI.replace(/<div className="space-y-6">/, '').trim(),
  "      <AIListingStudio />",
  "      <VariationMatrix />",
  "      <EtsyPublisher />",
  "    </div>",
  "  );",
  "};",
  "",
  "export const EtsySeoHelper: React.FC<{ renderedMatches?: any[] }> = ({ renderedMatches = [] }) => {",
  "  return (",
  "    <EtsySeoProvider renderedMatches={renderedMatches}>",
  "      <EtsySeoContent />",
  "    </EtsySeoProvider>",
  "  );",
  "};"
].join('\n');

fs.mkdirSync('d:/Projelerim/automania-next/src/components/seo/context', { recursive: true });
fs.mkdirSync('d:/Projelerim/automania-next/src/components/seo/tabs', { recursive: true });

fs.writeFileSync('d:/Projelerim/automania-next/src/components/seo/context/EtsySeoContext.tsx', contextContent);
fs.writeFileSync('d:/Projelerim/automania-next/src/components/seo/tabs/AIListingStudio.tsx', studioFile);
fs.writeFileSync('d:/Projelerim/automania-next/src/components/seo/tabs/VariationMatrix.tsx', variationsFile);
fs.writeFileSync('d:/Projelerim/automania-next/src/components/seo/tabs/EtsyPublisher.tsx', publishFile);
fs.writeFileSync('d:/Projelerim/automania-next/src/components/seo/EtsySeoHelper.tsx', mainFile);

console.log('Refactoring complete');
