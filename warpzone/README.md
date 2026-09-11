# @alexstevovich/warpzone

A legacy compatibility facade for common filesystem operations.

```js
import warpzone from '@alexstevovich/warpzone'

await warpzone.write('./message.txt', 'hello')
const files = await warpzone.list('./content', { recursive: true })
const content = await warpzone.string('./content', { extensions: ['.md'] })
```

Warpzone is retained for compatibility rather than recommended for new work.
Its historical `io8`, `lifi`, and `strdir` implementations are intentionally
frozen under `src/vendor/`, so it has no runtime package dependencies and does
not track the current packages with related names.

This package uses ECMAScript modules and is private until explicitly reviewed
for publication.

## License

MIT. Copyright (c) 2015 Alex Stevovich (https://alexstevovich.com).
