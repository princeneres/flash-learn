import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditor, EditorContent, Node, mergeAttributes } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
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

const randomRef = (ext: string): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${ext}`;

const extFromMime = (type: string, fallback: string): string => {
  const m = type.match(/\/(\w+)/);
  if (!m) return fallback;
  const sub = m[1].toLowerCase();
  if (sub === 'jpeg') return '.jpg';
  if (sub === 'svg+xml') return '.svg';
  if (sub === 'mpeg') return '.mp3';
  return `.${sub}`;
};

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
});

const MediaImage = Image.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      inline: true,
      allowBase64: false,
    };
  },
});

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
          'prose prose-sm dark:prose-invert max-w-none min-h-[120px] focus:outline-none px-3 py-2',
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
      const ref = randomRef(extFromMime(file.type, '.png'));
      await MediaStorageService.put('image', ref, file);
      editor.chain().focus().setImage({ src: `media://${ref}`, alt: file.name }).run();
    },
    [editor]
  );

  const insertAudio = useCallback(
    async (file: File) => {
      if (!editor) return;
      const ref = randomRef(extFromMime(file.type, '.mp3'));
      await MediaStorageService.put('audio', ref, file);
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

      <EditorContent editor={editor} placeholder={placeholder} />
    </div>
  );
};
