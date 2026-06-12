$base = "$PSScriptRoot\..\apps\api\src"

$modules = @(
  @{ dir="crm\clients";      name="clients"    },
  @{ dir="crm\contracts";    name="contracts"  },
  @{ dir="crm\invoices";     name="invoices"   },
  @{ dir="operations\sites"; name="sites"      },
  @{ dir="operations\agents";name="agents"     },
  @{ dir="operations\pointages"; name="pointages" },
  @{ dir="operations\patrols";   name="patrols"   },
  @{ dir="hr";               name="hr"         },
  @{ dir="stock";            name="stock"      },
  @{ dir="whatsapp";         name="whatsapp"   },
  @{ dir="ai";               name="ai"         },
  @{ dir="storage";          name="storage"    }
)

foreach ($m in $modules) {
  $dir  = "$base\$($m.dir)"
  $name = $m.name
  $cap  = (Get-Culture).TextInfo.ToTitleCase($name)

  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

  $svcFile = "$dir\$name.service.ts"
  $ctlFile = "$dir\$name.controller.ts"
  $modFile = "$dir\$name.module.ts"

  if (!(Test-Path $svcFile)) {
    @"
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class ${cap}Service {
  constructor(private prisma: PrismaService) {}
}
"@ | Set-Content $svcFile -Encoding UTF8
    Write-Host "Created $svcFile"
  }

  if (!(Test-Path $ctlFile)) {
    @"
import { Controller, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { ${cap}Service } from './$name.service'

@ApiTags('$cap')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('$name')
export class ${cap}Controller {
  constructor(private ${name}Service: ${cap}Service) {}
}
"@ | Set-Content $ctlFile -Encoding UTF8
    Write-Host "Created $ctlFile"
  }

  if (!(Test-Path $modFile)) {
    @"
import { Module } from '@nestjs/common'
import { ${cap}Service } from './$name.service'
import { ${cap}Controller } from './$name.controller'

@Module({ providers: [${cap}Service], controllers: [${cap}Controller], exports: [${cap}Service] })
export class ${cap}Module {}
"@ | Set-Content $modFile -Encoding UTF8
    Write-Host "Created $modFile"
  }
}

Write-Host "`n✅ Stubs generated!" -ForegroundColor Green
