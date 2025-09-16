import { Directive, ElementRef, HostListener, Input, AfterViewInit } from '@angular/core';
import { CurrencyPipe } from '@angular/common';

@Directive({
  selector: '[appCurrencyFormat]',
  providers: [CurrencyPipe],
  standalone: true,
})
export class CurrencyFormatDirective implements AfterViewInit {
  @Input() currencyCode: string = 'USD';
  @Input() displayFormat: 'symbol' | 'code' | 'symbol-narrow' | string = 'symbol';
  @Input() digitsInfo: string = '1.2-2';

  private el: HTMLInputElement;

  constructor(
    private elementRef: ElementRef,
    private currencyPipe: CurrencyPipe,
  ) {
    this.el = this.elementRef.nativeElement;
  }

  ngAfterViewInit() {
    // Initial formatting on load
    this.el.value = this.transform(this.el.value, this.currencyCode, this.displayFormat, this.digitsInfo);
  }

  @HostListener('focus', ['$event.target.value'])
  onFocus(value: string) {
    // On focus, display the raw number for easier editing
    this.el.value = this.parse(value);
  }

  @HostListener('blur', ['$event.target.value'])
  onBlur(value: string) {
    // On blur, format the input as currency
    this.el.value = this.transform(value, this.currencyCode, this.displayFormat, this.digitsInfo);
  }

  @HostListener('input', ['$event.target.value'])
  onInput(value: string) {
    // You can add real-time formatting here if desired, but blur is common for currency
    // For example, to prevent invalid characters:
    const parsedValue = this.parse(value);
    if (this.el.value !== parsedValue) {
      this.el.value = parsedValue;
    }
  }

  // Parses a currency string back to a number
  parse(value: string): string {
    return value.replace(/[^0-9.]/g, ''); // Remove non-numeric characters except decimal
  }

  // Transforms a number to a formatted currency string
  transform(value: string, currencyCode: string = 'USD', display: 'symbol' | 'code' | 'symbol-narrow' | string = 'symbol', digitsInfo: string = '1.2-2'): string {
    const parsedValue = parseFloat(this.parse(value));
    if (isNaN(parsedValue)) {
      return '';
    }
    return this.currencyPipe.transform(parsedValue, currencyCode, display, digitsInfo) || '';
  }

}