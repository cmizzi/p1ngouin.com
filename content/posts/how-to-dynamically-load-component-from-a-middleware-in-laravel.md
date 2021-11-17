---
title: How to dynamically load a component from a middleware in Laravel
description: Sometime, you want to load a component for a specific website but you don't want to rewrite another component and conditionnaly call it. This is the solution.
---

Sometime, you want to load a component for a specific website (depending on a condition) but
you don't want to add a specific condition in the view to call the specific-component instead of
the default one. There's a solution.

```php
<?php

namespace App\Http\Middleware;

use \Closure;
use Illuminate\Http\Request;

class PrependViewsLocationWithHostTheme
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): mixed
    {
        // For example, we have multiple hosts bind on the application. We want to load different component based only
        // the hostname :
        //
        // - example.com
        // - example.fr
        //
        // So, in your views directory, you can have something like this :
        //
        // - resources/views/components/navbar.blade.php
        // - resources/views/themes/example.fr/components/navbar.blade.php
        $host = $request->getHost();

        // Prepend the view finder list of location with our new path.
        //
        // [
        //  "resources/views/themes",
        //  "resources/views",
        // ]
        app("view")->getFinder()->prependLocation(resource_path("views/themes/{$host}"));

        // Now, when you call `<x-navbar />`, it will load using the following rules : 
        //
        // - (1) resources/views/themes/{host}/components/navbar.blade.php
        // - (2) resources/views/components/navbar.blade.php
        //
        // If the component doesn't exist in the `themes` directory, it will fallback on the default component.
        return $next($request);
    }
}
```

```html
<!-- Don't do this. -->
@if (request()->getHost() === "example.fr")
        <x:example-fr-navbar />
@else
        <x:navbar />
@endif

<!-- But do this instead -->
<x:navbar />

<!--
    This will try to load `resources/views/theme/example.fr/components/navbar.blade.php`
    before trying to load `resources/views/components/navbar.blade.php` thanks to the middleware.
-->
```
