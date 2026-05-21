"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type CompressConfirmDialogProps = {
  totalSizeMb: string;
  maxMb: number;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export default function CompressConfirmDialog({
  totalSizeMb,
  maxMb,
  onCancel,
  onConfirm,
}: CompressConfirmDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent showCloseButton={false} className="rounded-2xl p-6">
        <DialogHeader className="gap-2">
          <DialogTitle>图片超过大小限制</DialogTitle>
          <DialogDescription className="text-sm leading-6">
            选中的图片总大小为 {totalSizeMb} MB，超过 {maxMb} MB 限制。是否压缩后上传？
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button className="bg-stone-950 text-white hover:bg-stone-800" onClick={() => void onConfirm()}>
            压缩并上传
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
