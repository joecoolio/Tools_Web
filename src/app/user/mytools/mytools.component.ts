import { Component, ElementRef, OnInit, ViewChild } from "@angular/core";
import { DataService, Tool, ToolCategory, ToolStatus } from "../../services/data.service";
import { MatCardModule } from "@angular/material/card";
import { MatSelectModule } from "@angular/material/select";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from "@angular/forms";
import { faTrash, faCirclePlus, faCircleMinus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { ImageService } from "../../services/image.service";
import { HttpErrorResponse } from "@angular/common/http";
import { catchError, EMPTY, forkJoin } from "rxjs";
import { MessageService } from "../../services/message.service";
import { BrowseToolsToolCardComponent } from "../../browsetools/toolcard.component";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatButtonModule } from "@angular/material/button";
import { CommonModule } from '@angular/common';
import { CurrencyFormatDirective } from "../../shared/currencyformat-directive";

export function moneyValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  const regex = /^\d+(\.\d{1,2})?$/;
  return regex.test(value) ? null : { invalidMoney: true };
}

export function numericValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const raw = `${control.value}`.replace(/[^\d.-]/g, '');
        const num = parseFloat(raw);
        return isNaN(num) ? { numeric: true } : null;
    };
}

@Component({
    selector: 'app-mytools',
    templateUrl: './mytools.component.html',
    styleUrl: './mytools.component.scss',
    imports: [
        MatCardModule,
        MatSelectModule,
        MatIconModule,
        MatTooltipModule,
        ReactiveFormsModule,
        FontAwesomeModule,
        BrowseToolsToolCardComponent,
        MatProgressSpinnerModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        CurrencyFormatDirective,
        CommonModule,
    ],
})
export class MyToolsComponent implements OnInit {
    @ViewChild('photoInput', { static: false }) fileInput!: ElementRef;

    faTrash = faTrash;
    faCirclePlus = faCirclePlus;
    faCircleMinus = faCircleMinus;
    loading: boolean = true; // Is data currently loading or not
    toolCategories: ToolCategory[] = []; // List of tool categories
    toolCategoryLoading: boolean = false; // True when guessing the category
    tools: Tool[] = []; // List of my tools
    selectedTool: Tool | undefined; // Selected tool for editing
    settingsForm!: FormGroup; // Web form
    photoPreview: string | ArrayBuffer | null = null; // Photo in the preview box
    photoChanged: boolean = false; // Flag indicating that the user selected a new photo

    constructor(
        private dataService: DataService,
        private imageService: ImageService,
        private fb: FormBuilder,
        private messageService: MessageService,
    ) { }

    ngOnInit(): void {
        // Setup form
        this.settingsForm = this.fb.group({
            id: ['', Validators.required],
            category: ['', Validators.required],
            brand: ['', Validators.required],
            short_name: ['', Validators.required],
            name: ['', Validators.required],
            replacement_cost: ['', [Validators.required, numericValidator()]],
            photo: [null, [Validators.required]], // required for new tool, not for existing
            product_url: ['', Validators.required],
            search_terms: this.fb.array([
                this.fb.control('', [Validators.required])
            ]),
        });

        // Get the tool categories for the dropdown
        this.dataService.getToolCategories()
        .subscribe(cats => {
            this.toolCategories = cats;
        });

        // Get all the tools I'm sharing
        this.refreshToolList();
    }

    // Get all the tools I'm sharing
    private refreshToolList() {
        this.dataService.getMyTools().subscribe(
            // Sort the list by ID so it's always in the same order
            tools => this.tools = tools.sort((a,b) => a.id - b.id)
        );
    }

    addNew() {
        // Set selected tool to a new one
        this.selectedTool = {
            id: -1,
            owner_id: -1,
            short_name: '',
            brand: '',
            name: '',
            product_url: '',
            replacement_cost: 0,
            category_id: -1,
            category: '',
            category_icon: '',
            latitude: 0,
            longitude: 0,
            distance_m: 0,
            photo_link: '',
            imageUrl: undefined,
            imageLoaded: false,
            loaded: false,
            ownerLoaded: false,
            ownerName: "",
            ownerimageUrl: undefined,
            ownerImageLoaded: false,
            status: ToolStatus.Unknown,
            search_terms: [],
        };

        // Update the form fields to blank values
        this.settingsForm.reset();

        // Search keywords
        this.clearKeywords();
        // Add a single placeholder keyword
        this.addKeyword("", true);

        Object.keys(this.settingsForm.controls).forEach(key => {
            const control = this.settingsForm.get(key);
            control?.setErrors(null);
            control?.markAsPristine();
            control?.markAsUntouched();
        });

        this.resetPhoto();

        // photo is mandatory for new tool
        this.settingsForm.get('photo')?.clearValidators();
        this.settingsForm.get('photo')?.addValidators(Validators.required);
    }

    // Get a guess of the tool category & keywords
    getSuggestions() {
        if (
            this.settingsForm.get('brand')?.value
            && this.settingsForm.get('short_name')?.value
            && this.settingsForm.get('name')?.value
        ) {
            let desc: string =
                this.settingsForm.get('brand')?.value + " " +
                this.settingsForm.get('short_name')?.value + " " +
                this.settingsForm.get('name')?.value;

            if (desc.length > 0) {
                this.toolCategoryLoading = true;
                // Calls all the different AI junk
                forkJoin([
                    this.dataService.getSuggestedCategory(desc),
                    this.dataService.getSuggestedKeywords(desc),
                ]).subscribe({
                    next: ([toolCategory, toolKeywords]) => {
                        // Handle the category first
                        if (toolCategory) {
                            this.settingsForm.patchValue({ category: toolCategory.id });
                        }

                        // Handle the keywords
                        if (toolKeywords && toolKeywords.length > 0) {
                            this.clearKeywords();
                            toolKeywords.forEach(keyword => this.addKeyword(keyword, false));
                        }
                    },
                    complete: () => this.toolCategoryLoading = false,
                    error: err => this.toolCategoryLoading = false
                });
            }
        }
    }

    selectTool(index: number) {
        this.selectedTool = this.tools[index];

        // Update the form fields
        this.settingsForm.patchValue({
            id: this.selectedTool?.id,
            category: this.selectedTool?.category_id,
            brand: this.selectedTool?.brand,
            short_name: this.selectedTool?.short_name,
            name: this.selectedTool?.name,
            replacement_cost: this.selectedTool?.replacement_cost,
            product_url: this.selectedTool?.product_url,
        });
        // Search keywords
        this.clearKeywords();
        this.selectedTool?.search_terms.forEach(st => {
            this.addKeyword(st, true);
        });

        this.settingsForm.markAsPristine();
        this.search_terms.markAsPristine();

        this.resetPhoto();

        // photo is not mandatory for existing tool
        this.settingsForm.get('photo')?.clearValidators();
    }

    onPhotoSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            this.imageService.resizeImageToDataUrl(file, 200, 200)
            .subscribe({
                next: url => {
                    this.settingsForm.patchValue({ photo: url });    
                    this.photoPreview = url;
                    this.photoChanged = true;
                },
                complete: () => console.log("Image load complete"),
                error: err => console.log("Failed to load image: " + err)
            });
        }
    }

    // Reset the photo input to the original value
    resetPhoto(): void {
        if (this.selectedTool) {
            if (this.fileInput) {
                this.fileInput.nativeElement.value = null;
                this.photoPreview = null;
            }
            if (this.selectedTool.photo_link) {
                this.dataService.getPicture(this.selectedTool.photo_link)
                .pipe(
                    catchError(error => {
                        // Check for invalid photo and load default
                        if (error instanceof HttpErrorResponse && error.status == 404) {
                            if (this.selectedTool) {
                                this.selectedTool.photo_link = "default_tool.svg";
                                return this.dataService.getPicture(this.selectedTool.photo_link)
                            }
                        }
                        return EMPTY;
                    })
                )
                .subscribe(blob => {
                    this.photoPreview = URL.createObjectURL(blob);
                    this.loading = false; // Done loading all data
                });
            }
            this.photoChanged = false;
        }
    }

    /////
    // Keywords
    /////
    get search_terms(): FormArray {
        return this.settingsForm.get('search_terms') as FormArray;
    }
    clearKeywords(): void {
        this.search_terms.clear();
        // this.settingsForm.markAsDirty();
    }
    addKeyword(value: string = "", clean: boolean): void {
        if (this.search_terms.length < 5) {
            const control = this.fb.control(value, [Validators.required]);
            if (clean) {
                control.setErrors(null);
                control.markAsPristine();
                control.markAsUntouched();
            } else {
                this.settingsForm.markAsDirty();
            }
            this.search_terms.push(control);
        }
    }
    removeKeyword(index: number): void {
        if (this.search_terms.length > 1) {
            this.search_terms.removeAt(index);
            this.settingsForm.markAsDirty();
        }
    }

    onSubmit() {
        if (this.settingsForm.valid) {
            const formData = new FormData();
            Object.entries(this.settingsForm.value).forEach(([key, value]) => {
                if (value != null) {
                    if (Array.isArray(value)) {
                        value.forEach((value, idx) => formData.append(key + '[]', value));
                    } else {
                        formData.append(key, value as string | Blob);
                    }
                }
            });

            // Send the data away
            this.loading = true;
            this.dataService.updateTool(formData)
            .subscribe(value => {
                this.loading = false;

                this.messageService.send('info', 'Your settings were saved!');

                // Refresh the left side list
                this.refreshToolList();

                // Clear the screen & setup for adding a new one
                this.addNew();
            })
        }
    }
}