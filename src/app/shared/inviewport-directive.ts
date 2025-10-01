import { Directive, ElementRef, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';

@Directive({
    selector: '[appInViewport]'
})
export class InViewportDirective implements OnInit, OnDestroy {
    @Output() visible = new EventEmitter<boolean>();

    private observer?: IntersectionObserver;
    private timer: any;

    constructor(private el: ElementRef) { }

    ngOnInit(): void {
        this.observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                // Start timer when entering viewport
                this.timer = setTimeout(() => {
                    this.visible.emit(true);
                }, 2000); // require 2s in viewport
            } else {
                // Reset timer when leaving
                clearTimeout(this.timer);
                this.visible.emit(false);
            }
        }, {
            threshold: 1.0 // 100% visible required
        });

        this.observer.observe(this.el.nativeElement);
    }

    ngOnDestroy(): void {
        this.observer?.disconnect();
    }
}
