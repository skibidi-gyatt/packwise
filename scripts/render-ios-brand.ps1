Add-Type -AssemblyName System.Drawing
$brandGreen = [System.Drawing.ColorTranslator]::FromHtml('#397762')
$brandNavy = [System.Drawing.ColorTranslator]::FromHtml('#173746')
$brandPaper = [System.Drawing.ColorTranslator]::FromHtml('#f3f5f7')
$brandFormat = [System.Drawing.StringFormat]::new()
$brandFormat.Alignment = [System.Drawing.StringAlignment]::Center
$brandFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
$brandIcon = [System.Drawing.Bitmap]::new(1024,1024,[System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$brandCanvas = [System.Drawing.Graphics]::FromImage($brandIcon)
$brandCanvas.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$brandCanvas.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$brandCanvas.Clear($brandGreen)
$brandFont = [System.Drawing.Font]::new('Arial',720,[System.Drawing.FontStyle]::Bold,[System.Drawing.GraphicsUnit]::Pixel)
$brandCanvas.DrawString('p',$brandFont,[System.Drawing.Brushes]::White,[System.Drawing.RectangleF]::new(0,-85,1024,1024),$brandFormat)
$brandIcon.Save((Join-Path $PWD 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$brandCanvas.Dispose(); $brandFont.Dispose(); $brandIcon.Dispose()
$brandSplash = [System.Drawing.Bitmap]::new(2732,2732,[System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$brandCanvas = [System.Drawing.Graphics]::FromImage($brandSplash)
$brandCanvas.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$brandCanvas.Clear($brandPaper)
$brandFont = [System.Drawing.Font]::new('Arial',140,[System.Drawing.FontStyle]::Bold,[System.Drawing.GraphicsUnit]::Pixel)
$brandBrush = [System.Drawing.SolidBrush]::new($brandNavy)
$brandCanvas.DrawString('packwise',$brandFont,$brandBrush,[System.Drawing.RectangleF]::new(0,0,2732,2732),$brandFormat)
foreach($brandName in @('splash-2732x2732.png','splash-2732x2732-1.png','splash-2732x2732-2.png')) {$brandSplash.Save((Join-Path $PWD ('ios/App/App/Assets.xcassets/Splash.imageset/'+$brandName)),[System.Drawing.Imaging.ImageFormat]::Png)}
$brandCanvas.Dispose(); $brandFont.Dispose(); $brandBrush.Dispose(); $brandSplash.Dispose(); $brandFormat.Dispose()
