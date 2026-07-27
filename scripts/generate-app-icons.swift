import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let outputDirectory = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? "build/app-icons")
let baseSize = 1024
let colorSpace = CGColorSpaceCreateDeviceRGB()
let context = CGContext(
    data: nil,
    width: baseSize,
    height: baseSize,
    bitsPerComponent: 8,
    bytesPerRow: 0,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
)

guard let context else {
    fatalError("Unable to create icon drawing context")
}

try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
context.clear(CGRect(x: 0, y: 0, width: baseSize, height: baseSize))

let pageRect = CGRect(x: 112, y: 88, width: 800, height: 848)
let pagePath = CGPath(
    roundedRect: pageRect,
    cornerWidth: 174,
    cornerHeight: 174,
    transform: nil
)

context.addPath(pagePath)
context.setFillColor(CGColor(red: 0.96, green: 0.91, blue: 0.78, alpha: 1))
context.fillPath()
context.addPath(pagePath)
context.setStrokeColor(CGColor(red: 0.34, green: 0.24, blue: 0.13, alpha: 1))
context.setLineWidth(24)
context.strokePath()

// Folded page corner.
let foldPath = CGMutablePath()
foldPath.move(to: CGPoint(x: 696, y: 936))
foldPath.addLine(to: CGPoint(x: 912, y: 720))
foldPath.addLine(to: CGPoint(x: 912, y: 762))
foldPath.addCurve(
    to: CGPoint(x: 738, y: 936),
    control1: CGPoint(x: 912, y: 858),
    control2: CGPoint(x: 836, y: 936)
)
foldPath.closeSubpath()
context.addPath(foldPath)
context.setFillColor(CGColor(red: 0.88, green: 0.77, blue: 0.56, alpha: 1))
context.fillPath()

// Markdown-style reading lines.
context.setStrokeColor(CGColor(red: 0.24, green: 0.18, blue: 0.12, alpha: 1))
context.setLineWidth(28)
context.setLineCap(.round)
for (index, length) in [520.0, 636.0, 460.0].enumerated() {
    let y = 570.0 - Double(index) * 104.0
    context.move(to: CGPoint(x: 270, y: y))
    context.addLine(to: CGPoint(x: 270 + length, y: y))
    context.strokePath()
}

// A warm bookmark accent.
let bookmarkPath = CGMutablePath()
bookmarkPath.move(to: CGPoint(x: 700, y: 612))
bookmarkPath.addLine(to: CGPoint(x: 780, y: 612))
bookmarkPath.addLine(to: CGPoint(x: 780, y: 370))
bookmarkPath.addLine(to: CGPoint(x: 740, y: 402))
bookmarkPath.addLine(to: CGPoint(x: 700, y: 370))
bookmarkPath.closeSubpath()
context.addPath(bookmarkPath)
context.setFillColor(CGColor(red: 0.79, green: 0.40, blue: 0.16, alpha: 1))
context.fillPath()

guard let image = context.makeImage() else {
    fatalError("Unable to render icon image")
}

let outputURL = outputDirectory.appendingPathComponent("icon.png")
guard let destination = CGImageDestinationCreateWithURL(
    outputURL as CFURL,
    UTType.png.identifier as CFString,
    1,
    nil
) else {
    fatalError("Unable to create PNG destination")
}
CGImageDestinationAddImage(destination, image, nil)
guard CGImageDestinationFinalize(destination) else {
    fatalError("Unable to write PNG icon")
}
