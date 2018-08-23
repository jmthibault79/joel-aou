import {AfterContentChecked, ChangeDetectorRef, Component, Input, OnChanges, OnInit} from '@angular/core';
import {FormControl} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {
  AnnotationType,
  CohortAnnotationDefinition,
  CohortReviewService,
  ModifyParticipantCohortAnnotationRequest,
  ParticipantCohortAnnotation,
} from 'generated';
import * as moment from 'moment';
interface Annotation {
  definition: CohortAnnotationDefinition;
  value: ParticipantCohortAnnotation;
}


@Component({
  selector: 'app-annotation-item',
  templateUrl: './annotation-item.component.html',
  styleUrls: ['./annotation-item.component.css']
})
export class AnnotationItemComponent implements OnInit, OnChanges, AfterContentChecked {
  readonly kinds = AnnotationType;

  @Input() annotation: Annotation;
  @Input() showDataType: boolean;
  textSpinnerFlag = false;
  successIcon = false;
  private control = new FormControl();
  private expandText = false;
  defaultAnnotation = false;
  annotationOption: any;
  oldValue: any;
  myDate: any;
  testSpinner = false;

  constructor(
    private reviewAPI: CohortReviewService,
    private route: ActivatedRoute,
    private cdref: ChangeDetectorRef
  ) {}

    ngOnChanges() {
        if (this.annotation.value[this.valuePropertyName]) {
            this.defaultAnnotation = true;
                this.annotationOption = this.annotation.value[this.valuePropertyName];
        } else {
            this.defaultAnnotation = false;
        }
    }

    ngOnInit() {
      this.ngAfterContentChecked();
        this.successIcon = false;
    const oldValue = this.annotation.value[this.valuePropertyName];
    if (oldValue !== undefined) {
      this.control.setValue(oldValue);
    }
  }

    ngAfterContentChecked() {
        this.cdref.detectChanges();
    }


    textBlur() {
        this.successIcon = false;
    this.textSpinnerFlag = true;
    setTimeout (() => {
        this.handleInput();
        } , 2000 );
  }


  handleInput() {
      this.textSpinnerFlag = false;
      this.successIcon = true;
    /* Parameters from the path */
    const {ns, wsid, cid} = this.route.parent.snapshot.params;
    const pid = this.annotation.value.participantId;
    const cdrid = +(this.route.parent.snapshot.data.workspace.cdrVersionId);
    const newValue = this.control.value;
     this.oldValue = this.annotation.value[this.valuePropertyName];
    const defnId = this.annotation.definition.cohortAnnotationDefinitionId;
    const annoId = this.annotation.value.annotationId;

    let apiCall;

    // Nothing to see here - if there's no change, no need to hit the server
    if (newValue === this.oldValue) {
      return ;
    }
    // If there is an annotation ID then the annotation has already been
    // created, so this must be either delete or update
    if (annoId !== undefined) {
      // If the new value isn't anything, this is a delete
      if (newValue === '' || newValue === null) {
        apiCall = this.reviewAPI
          .deleteParticipantCohortAnnotation(ns, wsid, cid, cdrid, pid, annoId);

      } else {
        const request = <ModifyParticipantCohortAnnotationRequest>{
          [this.valuePropertyName]: newValue,
        };
        apiCall = this.reviewAPI
          .updateParticipantCohortAnnotation(ns, wsid, cid, cdrid, pid, annoId, request);
      }
    } else {
    // There's no annotation ID so this must be a create
      const request = <ParticipantCohortAnnotation> {
        cohortAnnotationDefinitionId: defnId,
        ...this.annotation.value,
        [this.valuePropertyName]: newValue,
      };
      apiCall = this.reviewAPI
        .createParticipantCohortAnnotation(ns, wsid, cid, cdrid, pid, request);
    }
      setTimeout (() => {
          this.successIcon = false;
      } , 2000 );
    apiCall.subscribe();
  }

  toggleExpandText() {
    this.expandText = !this.expandText;
  }

  get valuePropertyName() {
    return {
      [AnnotationType.STRING]:   'annotationValueString',
      [AnnotationType.DATE]:     'annotationValueDate',
      [AnnotationType.ENUM]:     'annotationValueEnum',
      [AnnotationType.BOOLEAN]:  'annotationValueBoolean',
      [AnnotationType.INTEGER]:  'annotationValueInteger'
    }[this.annotation.definition.annotationType];
  }

  get machineName() {
    return this.annotation.definition.columnName.split(' ').join('-');
  }

  get datatypeDisplay() {
        return this.showDataType
          ? ` (${this.annotation.definition.annotationType})`
          : '';
      }

  annotationOptionChange(value) {
    this.annotationOption = value;
    this.defaultAnnotation = true;
    this.control.patchValue(value);
    this.oldValue = value;
    this.textBlur();

  }

  dateChange(e) {
    this.successIcon = false;
    this.textSpinnerFlag = true;
    setTimeout (() => {
        if (e !== null) {
            const newDate = moment(e).format('YYYY-MM-DD');
            this.control.patchValue(newDate);
           this.handleInput();
        } }, 2000);
  }

}
