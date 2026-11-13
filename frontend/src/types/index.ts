export type NavItem = {
  id: string;
  label: string;
  href: string;
  description?: string;
};

export type ContentMode = 'figma_exact' | 'cultural_full';

export interface ModalContent {
  title: string;
  subtitle?: string;
  content: React.ReactNode;
}
