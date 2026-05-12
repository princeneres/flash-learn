import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useEditor,
  EditorContent,
  Node,
  mergeAttributes,
  ReactNodeViewRenderer,
  type Editor,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { ImageNodeView, AudioNodeView } from './MediaNodeView';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Link as LinkIcon,
  Image as ImageIcon,
  AudioLines,
  Undo2,
  Redo2,
  Code,
  Quote,
} from 'lucide-react';
import { MediaStorageService } from '../services/MediaStorageService';
import { Button } from './ui/button';
import { sanitizeRichHtml } from '../lib/sanitize';
import { downscaleImage, extensionFromType } from '../lib/image';
import { parseMediaSrc } from '../lib/media';

const randomRef = (ext: string): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${ext}`;

const AudioNode = Node.create({
  name: 'audio',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      controls: { default: true },
    };
  },
  parseHTML() {
    return [{ tag: 'audio' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['audio', mergeAttributes(HTMLAttributes, { controls: 'controls' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(AudioNodeView);
  },
});

const MediaImage = Image.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      inline: true,
      allowBase64: false,
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

const removeExistingMediaNodes = (editor: Editor, typeName: 'image' | 'audio'): string[] => {
  const positions: number[] = [];
  const refs: string[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === typeName) {
      positions.push(pos);
      const ref = parseMediaSrc(node.attrs.src as string | null | undefined);
      if (ref) refs.push(ref);
    }
  });
  if (positions.length === 0) return refs;
  let tr = editor.state.tr;
  for (const pos of [...positions].reverse()) {
    const node = tr.doc.nodeAt(pos);
    if (node) tr = tr.delete(pos, pos + node.nodeSize);
  }
  editor.view.dispatch(tr);
  return refs;
};

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export const CardEditor: React.FC<Props> = ({ value, onChange, placeholder, autoFocus }) => {
  const { t } = useTranslation();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const insertImageRef = useRef<(file: File) => Promise<void>>(async () => {});
  const insertAudioRef = useRef<(file: File) => Promise<void>>(async () => {});

  const handleFiles = useCallback((files: FileList | File[] | null | undefined): boolean => {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return false;
    const img = list.find((f) => f.type.startsWith('image/'));
    const aud = list.find((f) => f.type.startsWith('audio/'));
    if (!img && !aud) return false;
    if (img) void insertImageRef.current(img);
    if (aud) void insertAudioRef.current(aud);
    return true;
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      MediaImage,
      AudioNode,
    ],
    content: value || '',
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        class:
          'rich-text min-h-[120px] focus:outline-none px-3 py-2',
      },
      handlePaste: (_view, event) => {
        const handled = handleFiles(event.clipboardData?.files);
        if (handled) event.preventDefault();
        return handled;
      },
      handleDrop: (_view, event) => {
        const dt = (event as DragEvent).dataTransfer;
        const handled = handleFiles(dt?.files);
        if (handled) event.preventDefault();
        return handled;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(sanitizeRichHtml(html));
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value && value !== current) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  const insertImage = useCallback(
    async (file: File) => {
      if (!editor) return;
      const processed = await downscaleImage(file);
      const mime = processed.type || file.type || 'image/jpeg';
      const ref = randomRef(extensionFromType(mime, '.png'));
      await MediaStorageService.put('image', ref, processed);
      const oldRefs = removeExistingMediaNodes(editor, 'image');
      if (oldRefs.length > 0) {
        void MediaStorageService.deleteMany(
          oldRefs.map((r) => ({ kind: 'image' as const, ref: r }))
        );
      }
      editor.chain().focus().setImage({ src: `media://${ref}`, alt: file.name }).run();
    },
    [editor]
  );

  const insertAudio = useCallback(
    async (file: File) => {
      if (!editor) return;
      const ref = randomRef(extensionFromType(file.type, '.mp3'));
      await MediaStorageService.put('audio', ref, file);
      const oldRefs = removeExistingMediaNodes(editor, 'audio');
      if (oldRefs.length > 0) {
        void MediaStorageService.deleteMany(
          oldRefs.map((r) => ({ kind: 'audio' as const, ref: r }))
        );
      }
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'audio',
          attrs: { src: `media://${ref}`, controls: true },
        })
        .run();
    },
    [editor]
  );

  useEffect(() => {
    insertImageRef.current = insertImage;
    insertAudioRef.current = insertAudio;
  }, [insertImage, insertAudio]);

  const promptLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt(t('cardEditor.linkPrompt'), prev ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor, t]);

  if (!editor) return null;

  const btn = (active: boolean) =>
    `h-8 px-2 ${active ? 'bg-accent text-accent-foreground' : ''}`;

  return (
    <div className="rounded-md border border-input bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b border-border/60 p-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={btn(editor.isActive('bold'))}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label={t('cardEditor.bold')}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={btn(editor.isActive('italic'))}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label={t('cardEditor.italic')}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={btn(editor.isActive('heading', { level: 1 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          aria-label={t('cardEditor.h1')}
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={btn(editor.isActive('heading', { level: 2 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label={t('cardEditor.h2')}
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={btn(editor.isActive('bulletList'))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label={t('cardEditor.bulletList')}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={btn(editor.isActive('orderedList'))}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label={t('cardEditor.orderedList')}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={btn(editor.isActive('blockquote'))}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          aria-label={t('cardEditor.quote')}
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={btn(editor.isActive('codeBlock'))}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          aria-label={t('cardEditor.code')}
        >
          <Code className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={btn(editor.isActive('link'))}
          onClick={promptLink}
          aria-label={t('cardEditor.link')}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => imageInputRef.current?.click()}
          aria-label={t('cardEditor.image')}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => audioInputRef.current?.click()}
          aria-label={t('cardEditor.audio')}
        >
          <AudioLines className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-6 w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          aria-label={t('cardEditor.undo')}
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          aria-label={t('cardEditor.redo')}
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void insertImage(f);
        }}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void insertAudio(f);
        }}
      />

      <div className="max-h-[40vh] overflow-y-auto">
        <EditorContent editor={editor} placeholder={placeholder} />
      </div>
    </div>
  );
};
