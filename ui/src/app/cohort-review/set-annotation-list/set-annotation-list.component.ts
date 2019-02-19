import {Component, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from 'rxjs/Subscription';

import {annotationDefinitionsStore, ReviewStateService} from 'app/cohort-review/review-state.service';

import {CohortAnnotationDefinition} from 'generated';

type DefnId = CohortAnnotationDefinition['cohortAnnotationDefinitionId'];

@Component({
  selector: 'app-set-annotation-list',
  templateUrl: './set-annotation-list.component.html',
  styleUrls: ['./set-annotation-list.component.css']
})
export class SetAnnotationListComponent implements OnInit, OnDestroy {
  subscription: Subscription;
  definitions: CohortAnnotationDefinition[];
  postSet: Set<DefnId> = new Set<DefnId>();

  constructor(private state: ReviewStateService) {}

  ngOnInit() {
    this.subscription = annotationDefinitionsStore
            .subscribe(defns => this.definitions = defns);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  isPosting(flag: boolean, defn: CohortAnnotationDefinition): void {
    const id = defn.cohortAnnotationDefinitionId;
    if (flag) {
      this.postSet.add(id);
    } else if (this.postSet.has(id)) {
      this.postSet.delete(id);
    }
  }

  get posting() {
    return this.postSet.size > 0;
  }

  get openEdit() {
    return this.state.editAnnotationManagerOpen.getValue();
  }

  set openEdit(value: boolean) {
    this.state.editAnnotationManagerOpen.next(value);
  }

}
