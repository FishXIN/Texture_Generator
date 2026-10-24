import { AssetDropzone } from './AssetDropzone';

type ElementsUploaderProps = {
  disabled?: boolean;
  onUpload: (files: File[]) => void | Promise<void>;
};

export function ElementsUploader({ disabled, onUpload }: ElementsUploaderProps) {
  return (
    <AssetDropzone
      title="元素素材"
      description="支持 PNG / JPEG / WEBP / SVG，可多选批量导入并随机排布。"
      accept="image/png,image/jpeg,image/webp,image/svg+xml"
      multiple
      disabled={disabled}
      onFiles={onUpload}
    />
  );
}
