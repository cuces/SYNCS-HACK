# UI IMPLEMENTATION SPECIFICATION
## Community Archive — Corner Stone

Build a responsive desktop web page for a cultural/family archive application called **Corner Stone**.

The target design is a **14-inch MacBook Pro desktop viewport: 1512 × 982 px**.

The aesthetic should feel:

- Warm
- Editorial
- Personal
- Slightly nostalgic
- Modern but not sterile
- Like a beautifully designed digital archive/library
- Not like social media
- Not like a generic SaaS dashboard
- Not overly minimalist

Avoid excessive rounded cards, gradients, glassmorphism, floating UI, excessive shadows, and pill-shaped UI elements.

The interface should feel **content-first and tactile**, with warm paper colours, editorial typography, photography, and subtle borders.

---

# 1. DESIGN TOKENS

## Colours

```css
--paper: #F7F3EB;
--surface: #FBF9F4;
--ink: #292821;
--muted: #706D63;
--border: #DED8CC;

--forest: #314936;
--sage: #778C78;
--pale-sage: #E4E9DE;

--terracotta: #A76A42;
--clay: #C79A72;
--pale-clay: #EFE0D2;

--search-bg: #EFEAE0;
```

Use approximately:

- 70% paper/cream
- 15% surface/off-white
- 8% forest/sage
- 5% terracotta/clay
- 2% other accents

Do NOT use green or terracotta as large decorative backgrounds.

Forest green should primarily indicate interaction, selection, or important actions.

Terracotta should primarily indicate content categories such as recipes.

---

# 2. TYPOGRAPHY

Use:

```text
Headings:
Playfair Display

Body/UI:
Inter
```

## Typography styles

### DISPLAY

```text
Font: Playfair Display
Weight: 500
Size: 40px
Line height: 46px
Letter spacing: -0.8px
Colour: #292821
```

### H1

```text
Font: Playfair Display
Weight: 500
Size: 32px
Line height: 38px
Colour: #292821
```

### H2

```text
Font: Playfair Display
Weight: 500
Size: 27px
Line height: 33px
Colour: #292821
```

### H3 / Card title

```text
Font: Playfair Display
Weight: 500
Size: 18px
Line height: 23px
Colour: #292821
```

### BODY

```text
Font: Inter
Weight: 400
Size: 15px
Line height: 23px
Colour: #706D63
```

### BODY SMALL

```text
Font: Inter
Weight: 400
Size: 13px
Line height: 19px
Colour: #706D63
```

### NAV

```text
Font: Inter
Weight: 500
Size: 14px
Line height: 20px
```

### LABEL

```text
Font: Inter
Weight: 600
Size: 11px
Line height: 14px
Letter spacing: 1.1px
Text transform: uppercase
```

### META

```text
Font: Inter
Weight: 400
Size: 12px
Line height: 17px
Colour: #817B70
```

---

# 3. SPACING SYSTEM

Use a 4px base spacing system.

```text
4px
8px
12px
16px
20px
24px
32px
40px
48px
64px
```

Avoid arbitrary spacing values.

Primary spacing:

```text
Page horizontal padding: 56px
Page top padding: 32px

Navigation height: 64px

Header → culture navigation: 40px

Culture navigation → main content: 32px

Sidebar → content: 36px

Card gap: 16px

Card internal padding: 16px
```

---

# 4. BORDER RADIUS

Do not use the same radius everywhere.

```text
Small controls: 6px
Sidebar items: 8px
Cards: 12px
Featured content: 16px
Culture selectors: 20px
Search: 21px
```

Avoid huge 24px–32px rounded rectangles.

---

# 5. PAGE STRUCTURE

The page should have this hierarchy:

```text
BODY
│
├── NAVIGATION
│
├── PAGE HEADER
│
├── CULTURE NAVIGATION
│
└── MAIN ARCHIVE
    │
    ├── CATEGORY SIDEBAR
    │
    └── ARCHIVE CONTENT
        │
        ├── SECTION HEADER
        │
        ├── FEATURED MEMORY
        │
        └── POST GRID
```

---

# 6. NAVIGATION

Height:

```text
64px
```

Horizontal padding:

```text
56px
```

Layout:

```text
┌──────────────────────────────────────────────────────────────┐
│ Corner Stone    My Family    Community                 Search  Amy│
└──────────────────────────────────────────────────────────────┘
```

Use horizontal flexbox.

### Logo

```text
Corner Stone

Font: Playfair Display
Size: 26px
Weight: 500
Letter spacing: -0.5px
Colour: #292821
```

Logo → navigation:

```text
48px
```

Navigation item spacing:

```text
28px
```

Navigation:

```text
My Family
Community
```

Font:

```text
Inter
14px
500
```

Active Community colour:

```text
#314936
```

Do NOT put the active navigation item inside a large pill.

---

# 7. PAGE HEADER

Position:

```text
32px below navigation
```

Use horizontal flexbox:

```text
LEFT                         RIGHT

Community Archive            Search archive...
Description
```

### Title

```text
Community Archive

Playfair Display
40px
500
46px line height
-0.8px letter spacing
#292821
```

### Description

```text
Explore stories, recipes and traditions
shared by families around the world.
```

```text
Inter
15px
400
23px line height
#706D63
```

Title → description:

```text
8px
```

---

# 8. SEARCH

Width:

```text
260px
```

Height:

```text
42px
```

Radius:

```text
21px
```

Background:

```text
#EFEAE0
```

Border:

```text
1px solid #E4DED2
```

Horizontal padding:

```text
15px
```

Icon:

```text
17px
```

Icon → text:

```text
9px
```

Text:

```text
Inter
14px
#706D63
```

Placeholder:

```text
Search archive...
```

---

# 9. CULTURE NAVIGATION

Margin top:

```text
40px
```

Label:

```text
EXPLORE BY CULTURE
```

Style:

```text
Inter
11px
600
1.1px letter spacing
#7A756B
```

Label → buttons:

```text
12px
```

Culture controls:

```text
Height: 38px
Padding: 0 17px
Radius: 19px
Gap: 8px
```

Default:

```text
Background: transparent
Border: 1px solid #D8D1C4
Colour: #4C4941
```

Selected:

```text
Background: #314936
Border: #314936
Colour: #F7F3EB
```

Example:

```text
[ All ] [ Greek ] [ Chinese ] [ Indian ] [ Korean ]
[ Vietnamese ] [ Filipino ] [ Lebanese ] [ More ↓ ]
```

These should behave as selectable filters.

Do not make them look like social media tags.

---

# 10. MAIN ARCHIVE

Margin top:

```text
32px
```

Use a two-column layout:

```text
Sidebar: 184px
Gap: 36px
Content: remaining width
```

At a 1512px viewport with 56px page padding:

```text
Available width = 1400px

Sidebar = 184px
Gap = 36px

Content = 1180px
```

---

# 11. CATEGORY SIDEBAR

Width:

```text
184px
```

Heading:

```text
CATEGORIES
```

Style:

```text
Inter
11px
600
1.1px letter spacing
#7A756B
```

Heading → list:

```text
12px
```

Each category:

```text
Height: 36px
Padding: 0 12px
Radius: 8px
Margin/gap: 4px
```

Text:

```text
Inter
14px
400
```

Active:

```text
Background: #E4E9DE
Colour: #314936
Weight: 600
```

Categories:

```text
All
Recipes
Stories
Traditions
Memories
Music
Family History
```

Use subtle line icons where appropriate.

Do not make each item a card.

---

# 12. ARCHIVE SECTION HEADER

Content width:

```text
1180px
```

Section title:

```text
RECIPES FROM CHINESE FAMILIES
```

Style:

```text
Playfair Display
27px
500
33px line height
#292821
```

Metadata:

```text
Chinese · Recipes · 24 contributions
```

Style:

```text
Inter
12px
400
#817B70
```

Title → metadata:

```text
5px
```

Metadata → content:

```text
20px
```

---

# 13. FEATURED MEMORY

Include one larger editorial-style featured post before the standard card grid.

Dimensions:

```text
Width: 100%
Height: 240px
Radius: 16px
```

Layout:

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌────────────────────┐    FEATURED MEMORY                  │
│  │                    │                                     │
│  │                    │    Grandma's Dumplings              │
│  │      IMAGE         │    Chinese · Recipe                 │
│  │                    │                                     │
│  │                    │    A recipe passed down through     │
│  │                    │    three generations...              │
│  └────────────────────┘                                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Image:

```text
Width: 420px
Height: 240px
Object-fit: cover
```

Content:

```text
Padding: 28px
```

Background:

```text
#FBF9F4
```

Border:

```text
1px solid #DED8CC
```

Do not use a large shadow.

---

# 14. POST GRID

Margin top:

```text
32px
```

Use 4 columns.

Content width:

```text
1180px
```

Gap:

```text
16px
```

Calculation:

```text
(1180 - 48) / 4 = 283px
```

Therefore:

```text
Card width: 283px
```

---

# 15. POST CARD

Width:

```text
283px
```

Background:

```text
#FBF9F4
```

Border:

```text
1px solid #E2DCD0
```

Radius:

```text
12px
```

Shadow:

```text
0 2px 8px rgba(40,35,25,0.045)
```

Keep shadow extremely subtle.

---

# 16. POST IMAGE

```text
Width: 283px
Height: 190px
Object-fit: cover
```

Top corners:

```text
12px
```

The image should be the primary visual element of the card.

---

# 17. POST CARD CONTENT

Padding:

```text
16px
```

Vertical structure:

```text
IMAGE
 ↓ 16px
TYPE
 ↓ 8px
TITLE
 ↓ 6px
DESCRIPTION
 ↓ 12px
CONTRIBUTOR
```

### Type

Example:

```text
RECIPE · CHINESE
```

```text
Inter
11px
600
0.5px letter spacing
#8A5D36
```

### Title

Example:

```text
Grandma's Dumplings
```

```text
Playfair Display
18px
500
23px line height
#292821
```

### Description

```text
Inter
13px
400
19px line height
#706D63
```

### Contributor

```text
Shared by the Chon Family
```

```text
Inter
11px
400
#8B867B
```

---

# 18. EXAMPLE CONTENT

Use realistic cultural archive content rather than generic placeholder text.

Example cards:

```text
Grandma's Dumplings
Chinese · Recipe

Soy Sauce Chicken
Chinese · Recipe

Grandma's Radish Cake
Chinese · Recipe

Sweet Red Bean Soup
Chinese · Recipe
```

Other categories can include:

```text
My Grandfather's Childhood Story
Korean · Story

Our Lunar New Year Traditions
Chinese · Tradition

The Song My Mother Taught Me
Greek · Music

How We Celebrate Easter
Greek · Tradition
```

Avoid usernames such as:

```text
@amy123
@grandma_92
```

The platform is about families and cultural knowledge, not social identity.

Use:

```text
Shared by the Chon Family
Shared by a Greek-Australian family
```

---

# 19. INTERACTION

## Culture filter

Clicking a culture should filter the archive.

Example:

```text
Chinese
```

shows only Chinese posts.

## Category filter

Clicking:

```text
Recipes
```

shows only recipe posts.

Both filters should be combinable:

```text
Culture = Chinese
Category = Recipes
```

Result:

```text
Recipes from Chinese families
```

## Search

Search should search:

- Post title
- Description
- Culture
- Category

---

# 20. POST DETAIL

Clicking a post opens a detailed archive view.

Do NOT make it resemble an Instagram post.

Structure:

```text
← Back to archive

┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                         LARGE IMAGE                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘

RECIPE · CHINESE

Grandma's Dumplings

Shared by the Chon Family

This recipe has been in our family for
over 60 years...

INGREDIENTS

...

METHOD

...

```

The page should feel like opening an **archival record**, not a social-media post.

---

# 21. RESPONSIVE BEHAVIOUR

Desktop target:

```text
1512 × 982
```

At widths below approximately 1100px:

```text
Hide/collapse sidebar
```

At widths below approximately 800px:

```text
2-column card grid
```

At widths below approximately 550px:

```text
1-column card grid
```

Culture filters should horizontally scroll or wrap.

Never allow the page to create unwanted horizontal scrolling.

---

# 22. DESIGN PRINCIPLES

Follow these rules throughout the implementation:

### 1. Content over chrome

The photos, stories and recipes should be the visual focus.

### 2. Archive, not social media

Do not use:

- Likes
- Comments
- Followers
- Hearts
- Engagement counts
- Infinite social feed
- User handles
- Algorithmic ranking

### 3. Avoid excessive cards

Not every UI element needs a rounded container.

Use the paper background to create hierarchy.

### 4. Use typography to create hierarchy

Playfair Display should create the editorial/cultural character.

Inter should handle functional information.

### 5. Use whitespace intentionally

Do not compress everything together.

### 6. Warm but modern

Use cream, forest green, muted terracotta and photography.

Do not make it look vintage or overly rustic.

### 7. Accessibility

Ensure:

- Minimum 44px tap targets for interactive controls where appropriate
- Strong text contrast
- Visible keyboard focus
- Semantic HTML
- Alt text for meaningful images
- Buttons for actions
- Proper heading hierarchy

---

# 23. HTML STRUCTURE

Use semantic HTML approximately like:

```html
<body>
  <header>
    <nav>
      ...
    </nav>
  </header>

  <main>
    <section class="archive-header">
      ...
    </section>

    <nav class="culture-navigation">
      ...
    </nav>

    <section class="archive-layout">

      <aside class="category-sidebar">
        ...
      </aside>

      <section class="archive-content">

        <header class="section-header">
          ...
        </header>

        <article class="featured-memory">
          ...
        </article>

        <section class="post-grid">
          <article class="post-card">
            ...
          </article>
        </section>

      </section>

    </section>
  </main>
</body>
```

---

# 24. CSS APPROACH

Use:

```text
CSS variables
Flexbox
CSS Grid
Auto-responsive sizing
```

Do not hardcode every element's absolute position.

Use:

```css
max-width
width: 100%
gap
padding
grid-template-columns
flex
```

rather than absolute positioning.

The desktop target should be pixel-accurate to the specifications above, but the implementation must remain responsive.

---

# 25. OVERALL VISUAL REFERENCE

The final page should communicate:

```text
             Corner Stone

     Community Archive

 Explore stories, recipes and traditions
 shared by families around the world.

 EXPLORE BY CULTURE
 [All] [Greek] [Chinese] [Indian] [Korean] ...

 ┌──────────────┬─────────────────────────────────────────┐
 │              │                                         │
 │  CATEGORIES  │  RECIPES FROM CHINESE FAMILIES         │
 │              │                                         │
 │  All         │  ┌─────────────────────────────────┐   │
 │  Recipes     │  │        FEATURED MEMORY          │   │
 │  Stories     │  │                                 │   │
 │  Traditions  │  └─────────────────────────────────┘   │
 │  Memories    │                                         │
 │  Music       │  [card] [card] [card] [card]            │
 │  History     │                                         │
 │              │                                         │
 └──────────────┴─────────────────────────────────────────┘
```

The end result should feel like **a digital cultural library that happens to be beautifully designed**, rather than a social media platform or generic dashboard.