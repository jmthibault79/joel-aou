import {NgModule} from '@angular/core';

import {EditComponent} from 'app/icons/edit/component';
import {ExpandComponent} from 'app/icons/expand/component';
import {NotebookComponent} from 'app/icons/notebook/component';
import {ScrollComponent} from 'app/icons/scroll/component';
import {ShareComponent} from 'app/icons/share/component';
import {ShrinkComponent} from 'app/icons/shrink/component';
import {TrashComponent} from 'app/icons/trash/component';

@NgModule({
  imports: [],
  declarations: [
    TrashComponent,
    EditComponent,
    ExpandComponent,
    NotebookComponent,
    ScrollComponent,
    ShareComponent,
    ShrinkComponent
  ],
  exports: [
    TrashComponent,
    EditComponent,
    ExpandComponent,
    NotebookComponent,
    ScrollComponent,
    ShareComponent,
    ShrinkComponent
  ],
  providers: []
})
export class IconsModule {}
