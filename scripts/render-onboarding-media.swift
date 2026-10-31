// Renders the onboarding videos, posters and demo images from assets/illustrations/source and code.
// Run from the app root: swift scripts/render-onboarding-media.swift
import AppKit
import AVFoundation

let res = "modules/tracking-android/android/src/main/res"
func rgb(_ h: UInt32, _ a: CGFloat = 1) -> CGColor {
  CGColor(red: CGFloat(h >> 16 & 255) / 255, green: CGFloat(h >> 8 & 255) / 255, blue: CGFloat(h & 255) / 255, alpha: a)
}
func text(_ c: CGContext, _ s: String, _ x: CGFloat, _ y: CGFloat, _ size: CGFloat, _ color: CGColor, bold: Bool = false, center: Bool = false) {
  let attr = NSAttributedString(string: s, attributes: [
    .font: NSFont.systemFont(ofSize: size, weight: bold ? .bold : .regular),
    .foregroundColor: NSColor(cgColor: color)!,
  ])
  let line = CTLineCreateWithAttributedString(attr)
  c.textPosition = CGPoint(x: center ? x - CTLineGetTypographicBounds(line, nil, nil, nil) / 2 : x, y: y)
  CTLineDraw(line, c)
}
func round(_ c: CGContext, _ r: CGRect, _ radius: CGFloat, _ color: CGColor) {
  c.setFillColor(color)
  c.addPath(CGPath(roundedRect: r, cornerWidth: radius, cornerHeight: radius, transform: nil))
  c.fillPath()
}
let captions = ["Morning coffee", "Waterfall trail", "Puppy zoomies", "Night market", "Golden hour surf", "Rainy city nights"]
let sources: [CGImage] = (1...6).map { i in
  let d = CGImageSourceCreateWithURL(URL(fileURLWithPath: "assets/illustrations/source/\(i).png") as CFURL, nil)!
  return CGImageSourceCreateImageAtIndex(d, 0, nil)!
}
/** Fills the frame, with a slow zoom and drift so each still reads as footage. */
func photo(_ c: CGContext, _ i: Int, _ w: CGFloat, _ h: CGFloat, _ p: CGFloat) {
  let img = sources[i]
  let cover = max(w / CGFloat(img.width), h / CGFloat(img.height))
  let zoom = i % 2 == 0 ? 1.04 + 0.10 * p : 1.14 - 0.10 * p
  let dw = CGFloat(img.width) * cover * zoom, dh = CGFloat(img.height) * cover * zoom
  let drift = (i % 3 == 0 ? 1 : -1) * (p - 0.5) * (dw - w) * 0.5
  c.interpolationQuality = .high
  c.draw(img, in: CGRect(x: (w - dw) / 2 + drift, y: (h - dh) / 2, width: dw, height: dh))
}
func actionIcon(_ c: CGContext, _ kind: Int, _ x: CGFloat, _ y: CGFloat, _ s: CGFloat) {
  c.setFillColor(rgb(0x000000, 0.35)); c.fillEllipse(in: CGRect(x: x - s, y: y - s, width: s * 2, height: s * 2))
  c.setStrokeColor(rgb(0xFFFFFF)); c.setLineWidth(s * 0.13); c.setLineCap(.round); c.setLineJoin(.round)
  let r = s * 0.5
  switch kind {
  case 0: // like
    c.beginPath()
    for k in 0..<10 {
      let a = CGFloat.pi / 2 + CGFloat(k) * .pi / 5, d = k % 2 == 0 ? r * 1.05 : r * 0.45
      let q = CGPoint(x: x + d * cos(a), y: y + d * sin(a))
      if k == 0 { c.move(to: q) } else { c.addLine(to: q) }
    }
    c.closePath(); c.strokePath()
  case 1: // comment
    c.addPath(CGPath(roundedRect: CGRect(x: x - r, y: y - r * 0.6, width: r * 2, height: r * 1.4), cornerWidth: r * 0.4, cornerHeight: r * 0.4, transform: nil))
    c.strokePath()
  default: // more
    for k in -1...1 { c.setFillColor(rgb(0xFFFFFF)); c.fillEllipse(in: CGRect(x: x + CGFloat(k) * r * 0.8 - s * 0.09, y: y - s * 0.09, width: s * 0.18, height: s * 0.18)) }
  }
}
func shade(_ c: CGContext, _ w: CGFloat, _ h: CGFloat) {
  let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: [rgb(0x000000, 0.72), rgb(0x000000, 0)] as CFArray, locations: [0, 1])!
  c.drawLinearGradient(g, start: .zero, end: CGPoint(x: 0, y: h * 0.28), options: [])
}
func counter(_ c: CGContext, _ w: CGFloat, _ h: CGFloat, _ n: Int, _ pop: CGFloat) {
  let pw = w * 0.2 * (1 + pop * 0.12), ph = w * 0.1 * (1 + pop * 0.12)
  round(c, CGRect(x: w - pw - w * 0.05, y: h * 0.86 - ph / 2, width: pw, height: ph), ph / 2, rgb(0x6C4CF1))
  text(c, "\(n)", w - pw / 2 - w * 0.05, h * 0.86 - w * 0.022, w * 0.06, rgb(0xFFFFFF), bold: true, center: true)
}
func reelFrame(_ c: CGContext, _ w: CGFloat, _ h: CGFloat, _ time: CGFloat) {
  let clip = 3.9 as CGFloat, swipe = 0.35 as CGFloat
  let n = Int(time / clip), inClip = time - CGFloat(n) * clip
  let progress = min(1, inClip / swipe), eased = n == 0 ? 1 : 1 - pow(1 - progress, 3)
  func page(_ i: Int, _ offset: CGFloat) {
    c.saveGState(); c.translateBy(x: 0, y: offset)
    c.clip(to: CGRect(x: 0, y: 0, width: w, height: h))
    photo(c, i % 6, w, h, min(1, (time - CGFloat(i) * clip + swipe) / (clip + swipe * 2)))
    shade(c, w, h)
    // Neutral controls and captions only: no app's interface is reproduced.
    for b in 0..<3 { actionIcon(c, b, w * 0.905, h * (0.42 - CGFloat(b) * 0.075), w * 0.052) }
    text(c, i % 2 == 0 ? "Instagram Reels" : "YouTube Shorts", w * 0.05, h * 0.105, w * 0.045, rgb(0xFFFFFF), bold: true)
    text(c, captions[i % 6], w * 0.05, h * 0.068, w * 0.04, rgb(0xFFFFFF, 0.9))
    c.restoreGState()
  }
  if n > 0 && progress < 1 { page(n - 1, eased * h) ; page(n, (eased - 1) * h) } else { page(n, 0) }
  counter(c, w, h, 12 + n, n > 0 && inClip < 0.5 ? sin(inClip / 0.5 * .pi) : 0)
}
func guideFrame(_ c: CGContext, _ w: CGFloat, _ h: CGFloat, _ time: CGFloat) {
  c.setFillColor(rgb(0x10102B)); c.fill(CGRect(x: 0, y: 0, width: w, height: h))
  let step = min(3, Int(time / 2)), inStep = time - CGFloat(step) * 2
  let titles = ["Accessibility", "Downloaded apps", "ScrollSnooze", "Allow access?"]
  text(c, titles[step], 36, h - 76, 38, rgb(0xFFFFFF), bold: true)
  func row(_ y: CGFloat, _ label: String?, on: Bool) {
    round(c, CGRect(x: 28, y: y, width: w - 56, height: 84), 18, rgb(on ? 0x2C2A66 : 0x1B1B3F))
    if let label { text(c, label, 52, y + 30, 27, rgb(0xFFFFFF), bold: on) }
    else { round(c, CGRect(x: 52, y: y + 34, width: 240, height: 16), 8, rgb(0x3A3A62)) }
  }
  var tap = CGPoint(x: w / 2, y: 0)
  switch step {
  case 0: row(h - 210, "Downloaded apps", on: true); row(h - 310, nil, on: false); row(h - 410, nil, on: false); tap.y = h - 168
  case 1: row(h - 210, "ScrollSnooze short-video counter", on: true); row(h - 310, nil, on: false); row(h - 410, nil, on: false); tap.y = h - 168
  case 2:
    row(h - 210, "Use this service", on: true)
    let on = inStep > 1.2
    round(c, CGRect(x: w - 136, y: h - 190, width: 84, height: 44), 22, rgb(on ? 0x6C4CF1 : 0x4A4A6A))
    c.setFillColor(rgb(0xFFFFFF)); c.fillEllipse(in: CGRect(x: on ? w - 92 : w - 132, y: h - 186, width: 36, height: 36))
    tap = CGPoint(x: w - 94, y: h - 168)
  default:
    round(c, CGRect(x: 44, y: 100, width: w - 88, height: h - 230), 26, rgb(0x1B1B3F))
    text(c, "Allow ScrollSnooze to count", w / 2, h - 210, 28, rgb(0xFFFFFF), center: true)
    text(c, "Reels and Shorts?", w / 2, h - 250, 28, rgb(0xFFFFFF), center: true)
    round(c, CGRect(x: 80, y: 130, width: w - 160, height: 76), 38, rgb(0x6C4CF1))
    text(c, "Allow", w / 2, 156, 30, rgb(0xFFFFFF), bold: true, center: true)
    tap.y = 168
  }
  let pulse = (inStep.truncatingRemainder(dividingBy: 1.2)) / 1.2
  c.setStrokeColor(rgb(0xFFD77A, 1 - pulse)); c.setLineWidth(5)
  c.strokeEllipse(in: CGRect(x: tap.x - 20 - pulse * 26, y: tap.y - 20 - pulse * 26, width: 40 + pulse * 52, height: 40 + pulse * 52))
}
func image(_ w: Int, _ h: Int, _ draw: (CGContext) -> Void) -> CGImage {
  let c = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue)!
  draw(c); return c.makeImage()!
}
func save(_ img: CGImage, _ path: String, _ type: String) {
  let d = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, type as CFString, 1, nil)!
  CGImageDestinationAddImage(d, img, [kCGImageDestinationLossyCompressionQuality: 0.85] as CFDictionary)
  precondition(CGImageDestinationFinalize(d))
}
func video(_ path: String, _ w: Int, _ h: Int, _ seconds: Double, _ bitrate: Int, _ draw: @escaping (CGContext, CGFloat) -> Void) {
  try? FileManager.default.removeItem(atPath: path)
  let writer = try! AVAssetWriter(outputURL: URL(fileURLWithPath: path), fileType: .mp4)
  let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: w, AVVideoHeightKey: h,
    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: bitrate, AVVideoProfileLevelKey: AVVideoProfileLevelH264MainAutoLevel],
  ])
  let pool = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: w, kCVPixelBufferHeightKey as String: h,
  ])
  writer.add(input); writer.startWriting(); writer.startSession(atSourceTime: .zero)
  for f in 0..<Int(seconds * 30) {
    while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.005) }
    var buf: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, pool.pixelBufferPool!, &buf)
    CVPixelBufferLockBaseAddress(buf!, [])
    let c = CGContext(data: CVPixelBufferGetBaseAddress(buf!), width: w, height: h, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buf!), space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
    draw(c, CGFloat(f) / 30)
    CVPixelBufferUnlockBaseAddress(buf!, [])
    pool.append(buf!, withPresentationTime: CMTime(value: CMTimeValue(f), timescale: 30))
  }
  input.markAsFinished()
  let done = DispatchSemaphore(value: 0)
  writer.finishWriting { done.signal() }
  done.wait()
  precondition(writer.status == .completed, "\(String(describing: writer.error))")
}

video("\(res)/raw/onboarding_reels.mp4", 720, 1280, 23.4, 4_000_000) { reelFrame($0, 720, 1280, $1) }
video("\(res)/raw/accessibility_guide.mp4", 640, 592, 8, 600_000) { guideFrame($0, 640, 592, $1) }
save(image(720, 1280) { reelFrame($0, 720, 1280, 1) }, "\(res)/drawable/onboarding_reels_poster.jpg", "public.jpeg")
save(image(640, 592) { guideFrame($0, 640, 592, 0.5) }, "\(res)/drawable/accessibility_guide_poster.jpg", "public.jpeg")
save(image(941, 1672) { photo($0, 2, 941, 1672, 0) }, "assets/illustrations/demo-reel-forest.png", "public.png")
save(image(941, 1672) { photo($0, 4, 941, 1672, 0) }, "assets/illustrations/demo-reel-coast.png", "public.png")
save(image(941, 1672) { photo($0, 1, 941, 1672, 0) }, "assets/illustrations/demo-reel-waterfall.jpg", "public.jpeg")
