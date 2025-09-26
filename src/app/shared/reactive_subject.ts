import { Observable, BehaviorSubject, EMPTY } from 'rxjs';
import { switchMap } from 'rxjs/operators';

// This gives you an observable sitting atop another observable
// that can change over time.  If a connection drops and is rebuilt,
// you simply reset this guy via setInner() and clients never miss
// a beat.
export class ReactiveObservableWrapper<T> {
  private inner$ = new BehaviorSubject<Observable<T> | undefined>(undefined);

  // Exposed observable that stays open and reacts when inner becomes defined
  public readonly stream$: Observable<T> = this.inner$.pipe(
    switchMap(obs => obs ?? EMPTY)
  );

  // Call this when the inner observable becomes available
  setInner(source$: Observable<T>): void {
    this.inner$.next(source$);
  }
}
