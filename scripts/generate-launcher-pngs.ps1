Add-Type -AssemblyName System.Drawing

$baseDir = "D:\Lynk ID\bot digital\bot digital\android\app\src\main\res"

$densities = @(
    @{ Name = "mipmap-mdpi"; Size = 48 },
    @{ Name = "mipmap-hdpi"; Size = 72 },
    @{ Name = "mipmap-xhdpi"; Size = 96 },
    @{ Name = "mipmap-xxhdpi"; Size = 144 },
    @{ Name = "mipmap-xxxhdpi"; Size = 192 }
)

foreach ($d in $densities) {
    $dirPath = Join-Path $baseDir $d.Name
    if (-not (Test-Path $dirPath)) {
        New-Item -ItemType Directory -Path $dirPath -Force | Out-Null
    }

    $size = $d.Size

    # 1. Render Squircle ic_launcher.png
    $bmpSquircle = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmpSquircle)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Background Squircle (WhatsApp emerald gradient)
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.ColorTranslator]::FromHtml("#25D366"),
        [System.Drawing.ColorTranslator]::FromHtml("#075E54"),
        45.0
    )

    # Squircle Path
    $corner = [float]($size * 0.26)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(1, 1, $corner, $corner, 180, 90)
    $path.AddArc($size - $corner - 2, 1, $corner, $corner, 270, 90)
    $path.AddArc($size - $corner - 2, $size - $corner - 2, $corner, $corner, 0, 90)
    $path.AddArc(1, $size - $corner - 2, $corner, $corner, 90, 90)
    $path.CloseFigure()
    $g.FillPath($gradBrush, $path)

    # WhatsApp White Speech Bubble
    $bubblePath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $bx = [float]($size * 0.16)
    $by = [float]($size * 0.16)
    $bw = [float]($size * 0.68)
    $bh = [float]($size * 0.68)
    $bubblePath.AddEllipse($bx, $by, $bw, $bh)
    # Add Tail pointing bottom-left
    $tailPoints = @(
        (New-Object System.Drawing.PointF([float]($size * 0.22), [float]($size * 0.68))),
        (New-Object System.Drawing.PointF([float]($size * 0.12), [float]($size * 0.88))),
        (New-Object System.Drawing.PointF([float]($size * 0.38), [float]($size * 0.82)))
    )
    $bubblePath.AddPolygon($tailPoints)

    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillPath($whiteBrush, $bubblePath)

    # Bold "AI" text in center (Deep WhatsApp Green)
    $fontSize = [float]($size * 0.32)
    $font = New-Object System.Drawing.Font("Arial", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $greenBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#075E54"))

    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

    $textRect = New-Object System.Drawing.RectangleF(
        [float]($size * 0.08),
        [float]($size * 0.16),
        [float]($size * 0.84),
        [float]($size * 0.68)
    )
    $g.DrawString("AI", $font, $greenBrush, $textRect, $sf)

    # Yellow sparkle accent
    $goldBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#FACC15"))
    $sparkleSize = [float]($size * 0.10)
    $spX = [float]($size * 0.68)
    $spY = [float]($size * 0.25)
    $g.FillEllipse($goldBrush, $spX, $spY, $sparkleSize, $sparkleSize)

    $launcherPath = Join-Path $dirPath "ic_launcher.png"
    $bmpSquircle.Save($launcherPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmpSquircle.Dispose()

    # 2. Render Circular ic_launcher_round.png
    $bmpRound = New-Object System.Drawing.Bitmap($size, $size)
    $g2 = [System.Drawing.Graphics]::FromImage($bmpRound)
    $g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Circle Background
    $circlePath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $circlePath.AddEllipse(1, 1, $size - 2, $size - 2)
    $g2.FillPath($gradBrush, $circlePath)

    # WhatsApp White Speech Bubble
    $g2.FillPath($whiteBrush, $bubblePath)

    # Bold "AI" text in center
    $g2.DrawString("AI", $font, $greenBrush, $textRect, $sf)

    # Yellow sparkle accent
    $g2.FillEllipse($goldBrush, $spX, $spY, $sparkleSize, $sparkleSize)

    $launcherRoundPath = Join-Path $dirPath "ic_launcher_round.png"
    $bmpRound.Save($launcherRoundPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g2.Dispose()
    $bmpRound.Dispose()

    $gradBrush.Dispose()
    $whiteBrush.Dispose()
    $greenBrush.Dispose()
    $goldBrush.Dispose()
    $font.Dispose()

    Write-Output "Generated PNG icons for $d.Name ($size x $size)"
}

Write-Output "All density PNG icons successfully generated!"
