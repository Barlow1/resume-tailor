import { useState, useRef } from 'react'
import ReactCrop, { type Crop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface ImageCropperProps {
  image: string
  onCrop: (croppedImage: string) => void
  onClose: () => void
}

export function ImageCropper({ image, onCrop, onClose }: ImageCropperProps) {
  const [crop, setCrop] = useState<Crop>({
    unit: 'px',
    width: 250,
    height: 250,
    x: 0,
    y: 0,
  })
  
  const imgRef = useRef<HTMLImageElement>(null)

  function getCroppedImg() {
    if (!imgRef.current) return

    const canvas = document.createElement('canvas')
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height
    canvas.width = crop.width
    canvas.height = crop.height
    const ctx = canvas.getContext('2d')

    if (!ctx) return

    ctx.drawImage(
      imgRef.current,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height,
    )

    const base64Image = canvas.toDataURL('image/jpeg')
    onCrop(base64Image)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="max-h-[600px] max-w-[600px] overflow-hidden rounded-lg bg-background p-4">
        <div className="max-h-[500px] max-w-[500px]">
          <ReactCrop
            crop={crop}
            onChange={c => setCrop(c)}
            aspect={1}
            circularCrop
          >
            <img 
              ref={imgRef} 
              src={image} 
              alt="Crop me" 
              className="!max-h-[500px] w-auto object-contain"
            />
          </ReactCrop>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded px-4 py-2 text-gray-600 hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={getCroppedImg}
            className="rounded bg-brand-800 px-4 py-2 text-white hover:bg-brand-500"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
} 