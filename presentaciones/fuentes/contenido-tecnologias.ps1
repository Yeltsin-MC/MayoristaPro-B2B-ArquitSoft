$s=NewSlide 'Tecnologías previstas para MayoristaPro' 'La diapositiva distingue decisiones de diseño de software ya implementado. Angular, TypeScript, NestJS, Node.js y PostgreSQL constituyen la base propuesta. GitHub aloja la documentación y el control de versiones. Redis, Python y FastAPI se incorporarán según las necesidades de caché y recomendación del alcance validado. AWS es la plataforma de despliegue prevista: EC2 para procesos, RDS para PostgreSQL, S3 para archivos y CloudWatch para monitoreo. SQS y workers se incorporarán cuando existan tareas asíncronas que lo justifiquen. Logos: Devicon, https://github.com/devicons/devicon , licencia MIT. Archivos SVG originales sin recolorear. Las marcas pertenecen a sus respectivos titulares.' 'README.md; docs/02-arquitectura-software/arquitectura-inicial.md; https://github.com/devicons/devicon'

function TechLogo($name,$key,$detail,$x,$y,$w=134,$h=130) {
    $frame=$s.Shapes.AddShape(5,$x,$y,$w,$h)
    $frame.Fill.ForeColor.RGB=$white
    $frame.Line.ForeColor.RGB=(Color 'DAE4EE')
    $path=Join-Path $repoRoot ('presentaciones/recursos/tecnologias/'+$key+'.svg')
    $null=$s.Shapes.AddPicture($path,0,-1,($x+$w/2-26),($y+12),52,52)
    $nameBox=Text $s $name ($x+4) ($y+75) ($w-8) 26 19 $navy $true
    $nameBox.TextFrame.TextRange.ParagraphFormat.Alignment=2
    $detailBox=Text $s $detail ($x+4) ($y+102) ($w-8) 25 13 $muted
    $detailBox.TextFrame.TextRange.ParagraphFormat.Alignment=2
}

$null=Text $s 'Base propuesta y control de versiones' 42 100 876 32 24 $blue $true
$core=@(
    @('Angular','angular','Interfaz web'),
    @('TypeScript','typescript','Lenguaje principal'),
    @('NestJS','nestjs','Backend modular'),
    @('Node.js','nodejs','Ejecución backend'),
    @('PostgreSQL','postgresql','Datos comerciales'),
    @('GitHub','github','Repositorio')
)
for($i=0;$i -lt $core.Count;$i++) { TechLogo $core[$i][0] $core[$i][1] $core[$i][2] (42+$i*148) 143 }

$null=Text $s 'Despliegue previsto y componentes según alcance' 42 295 876 32 24 $teal $true
$extra=@(
    @('AWS','amazonwebservices','Despliegue y servicios'),
    @('Redis','redis','Caché temporal'),
    @('Python','python','Recomendación'),
    @('FastAPI','fastapi','API de recomendación')
)
for($i=0;$i -lt $extra.Count;$i++) { TechLogo $extra[$i][0] $extra[$i][1] $extra[$i][2] (42+$i*222) 337 210 130 }
$null=Text $s 'Implementación pendiente. Servicios AWS previstos: EC2, RDS, S3, CloudWatch y SQS' 42 480 876 24 16 $muted
