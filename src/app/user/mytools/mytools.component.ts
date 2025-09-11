import { Component, ElementRef, OnInit, ViewChild } from "@angular/core";
import { DataService, Tool, ToolCategory, ToolStatus } from "../../services/data.service";
import { MatCardModule } from "@angular/material/card";
import { MatSelectModule } from "@angular/material/select";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from "@angular/forms";
import { faTrash, faCirclePlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { ImageService } from "../../services/image.service";
import { HttpErrorResponse } from "@angular/common/http";
import { catchError, EMPTY } from "rxjs";
import { MessageService } from "../../services/message.service";
import { BrowseToolsToolCardComponent } from "../../browsetools/toolcard.component";

export function moneyValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  const regex = /^\d+(\.\d{1,2})?$/;
  return regex.test(value) ? null : { invalidMoney: true };
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
        BrowseToolsToolCardComponent
    ]
})
export class MyToolsComponent implements OnInit {
    @ViewChild('photoInput', { static: false }) fileInput!: ElementRef;

    faTrash = faTrash;
    faCirclePlus = faCirclePlus;
    loading: boolean = true; // Is data currently loading or not
    toolCategories: ToolCategory[] = []; // List of tool categories
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
            replacement_cost: ['', [Validators.required, moneyValidator]],
            photo: [null, Validators.required],
            product_url: ['', Validators.required],
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
        };

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

        this.resetPhoto();
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

        this.resetPhoto();
    }

    onPhotoSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            this.imageService.resizeImageToDataUrl(file, 200, 200)
            .subscribe(url => {
                this.settingsForm.patchValue({ photo: url });    
                this.photoPreview = url;
                this.photoChanged = true;
            })
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

    onSubmit() {
        if (this.settingsForm.valid) {
            const formData = new FormData();
            Object.entries(this.settingsForm.value).forEach(([key, value]) => {
                formData.append(key, value as string | Blob);
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