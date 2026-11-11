import { provideHttpClient } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { CatalogComponent } from './catalog';

bootstrapApplication(CatalogComponent, { providers: [provideHttpClient()] })
  .catch(error => console.error(error));
