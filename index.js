// ---------------- Health Check ----------------
app.get('/healthz', (req, res) => {
  res.status(200).send('ok');
});

// ---------------- Start (Render) ----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Guest Assistant running on port ${PORT}`);
});
